package dev.goafk.live

import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import android.graphics.drawable.Icon
import android.net.Uri
import android.os.Build
import android.provider.Settings
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

/**
 * "Agent working" as an Android 16 Live Update: an ongoing, promoted notification whose status-bar
 * chip shows a running timer (or "Needs you"), with a segmented progress bar (one segment per plan
 * step) that the afk mark slides along, and a short green "Done" state at the end.
 * On older Android it's a quiet ongoing notification with a progress bar.
 */
class AfkLiveModule : Module() {
  private val context: Context
    get() = appContext.reactContext ?: throw IllegalStateException("No context")

  private val manager: NotificationManager
    get() = context.getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager

  private fun ensureChannel() {
    if (manager.getNotificationChannel(CHANNEL) != null) return
    // Default importance (Live Updates aren't promoted from minimised channels), but silent.
    val ch = NotificationChannel(CHANNEL, "Agents working", NotificationManager.IMPORTANCE_DEFAULT).apply {
      description = "Live progress while an agent works on your computer"
      setSound(null, null)
      enableVibration(false)
      setShowBadge(false)
    }
    manager.createNotificationChannel(ch)
  }

  private fun smallIcon(): Int {
    val res = context.resources
    val id = res.getIdentifier("notification_icon", "drawable", context.packageName)
    return if (id != 0) id else context.applicationInfo.icon
  }

  /** What every state shares: thread title, current step, "project · Mac" in the header, tap to open. */
  private fun base(key: String, title: String, text: String, sub: String, url: String): Notification.Builder {
    val open = PendingIntent.getActivity(
      context,
      key.hashCode(),
      Intent(Intent.ACTION_VIEW, Uri.parse(url)).setPackage(context.packageName).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_SINGLE_TOP),
      PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE,
    )
    return Notification.Builder(context, CHANNEL)
      .setSmallIcon(smallIcon())
      .setContentTitle(title)
      .setContentText(text)
      .setSubText(sub.ifEmpty { null })
      .setContentIntent(open)
      .setOnlyAlertOnce(true)
      .setCategory(Notification.CATEGORY_PROGRESS)
  }

  private fun Map<String, Any?>.str(k: String) = (this[k] as? String) ?: ""
  private fun Map<String, Any?>.int(k: String) = (this[k] as? Number)?.toInt() ?: 0

  private fun icon(name: String): Icon? {
    val id = context.resources.getIdentifier(name, "drawable", context.packageName)
    return if (id != 0) Icon.createWithResource(context, id) else null
  }

  /** When this thread's run started: kept while its notification is up (also across app restarts). */
  private fun startedAt(key: String): Long {
    starts[key]?.let { return it }
    val existing = manager.activeNotifications.firstOrNull { it.tag == TAG && it.id == key.hashCode() }?.notification?.`when`
    val t = existing?.takeIf { it > 0 } ?: System.currentTimeMillis()
    starts[key] = t
    return t
  }

  override fun definition() = ModuleDefinition {
    Name("AfkLive")

    /** Whether the system will show promoted (status-bar) notifications from this app. */
    Function("canPromote") {
      if (Build.VERSION.SDK_INT >= 36) manager.canPostPromotedNotifications() else false
    }

    Function("supported") { Build.VERSION.SDK_INT >= 36 }

    /**
     * Shows or updates the live notification for one thread.
     * `state`: "working" (timer ticks in the chip, afk mark slides along the plan), "waiting" (amber,
     * "Needs you"). `chip` overrides the chip text when not empty. Returns whether it qualifies for promotion.
     * `promote`: ask for the status-bar chip (the user can turn that off in afk's Settings).
     */
    Function("show") { key: String, o: Map<String, Any?> ->
      val title = o.str("title"); val text = o.str("text"); val sub = o.str("sub"); val chip = o.str("chip"); val url = o.str("url")
      val done = o.int("done"); val total = o.int("total"); val promote = o["promote"] == true; val state = o.str("state")
      ensureChannel()
      val waiting = state == "waiting"
      val b = base(key, title, text, sub, url)
        .setOngoing(true)
        .setColor(if (waiting) AMBER else ACCENT)
        // Keep the start time across updates, so the chip's timer counts the whole run.
        .setWhen(startedAt(key))
        .setShowWhen(true)
        .setUsesChronometer(!waiting)
      if (Build.VERSION.SDK_INT >= 36) {
        val style = Notification.ProgressStyle().setStyledByProgress(true)
        val color = if (waiting) AMBER else ACCENT
        if (total > 0) {
          // One segment per plan step (the gaps between segments mark the steps).
          for (i in 0 until total) style.addProgressSegment(Notification.ProgressStyle.Segment(STEP).setColor(color))
          // Halfway into the current step, so the mark sits inside the step being worked on.
          val pos = if (done >= total) total * STEP else done.coerceIn(0, total) * STEP + STEP / 2
          style.setProgress(pos)
        } else {
          style.addProgressSegment(Notification.ProgressStyle.Segment(100).setColor(color))
          style.setProgressIndeterminate(!waiting)
          if (waiting) style.setProgress(50)
        }
        icon(if (waiting) "afk_live_wait" else "afk_live_tracker")?.let { style.setProgressTrackerIcon(it) }
        icon("afk_live_done")?.let { style.setProgressEndIcon(it) }
        b.setStyle(style)
        if (promote) {
          val c = chip.ifEmpty { if (waiting) "Needs you" else "" }
          // Empty: the chip shows the running timer instead of text.
          if (c.isNotEmpty()) b.setShortCriticalText(c)
          b.extras.putBoolean(EXTRA_REQUEST_PROMOTED, true)
        }
      } else if (total > 0) {
        b.setProgress(total, done.coerceIn(0, total), false)
      } else {
        b.setProgress(0, 0, !waiting)
      }
      val n = b.build()
      manager.notify(TAG, key.hashCode(), n)
      if (Build.VERSION.SDK_INT >= 36) n.hasPromotableCharacteristics() else false
    }

    /** The run ended: a full green bar and a "Done" chip for a few seconds, then it goes away. */
    Function("finish") { key: String, o: Map<String, Any?> ->
      val title = o.str("title"); val text = o.str("text"); val sub = o.str("sub"); val url = o.str("url")
      val total = o.int("total"); val promote = o["promote"] == true
      ensureChannel()
      // "Finished in 2m 14s": how long the run took, from when its live notification first appeared.
      val secs = ((System.currentTimeMillis() - startedAt(key)) / 1000).coerceAtLeast(1)
      val took = if (secs < 60) "${secs}s" else if (secs < 3600) "${secs / 60}m ${secs % 60}s" else "${secs / 3600}h ${(secs % 3600) / 60}m"
      val b = base(key, title, if (text == "Finished") "Finished in $took" else text, sub, url)
        .setOngoing(promote) // promoted Live Updates must be ongoing; the timeout still removes it
        .setTimeoutAfter(6_000)
        .setColor(DONE)
        .setWhen(startedAt(key))
        .setShowWhen(true)
      if (Build.VERSION.SDK_INT >= 36) {
        val steps = if (total > 0) total else 1
        val style = Notification.ProgressStyle().setStyledByProgress(true)
        for (i in 0 until steps) style.addProgressSegment(Notification.ProgressStyle.Segment(STEP).setColor(DONE))
        style.setProgress(steps * STEP)
        icon("afk_live_done")?.let { style.setProgressTrackerIcon(it) }
        b.setStyle(style)
        if (promote) {
          b.setShortCriticalText("Done")
          b.extras.putBoolean(EXTRA_REQUEST_PROMOTED, true)
        }
      }
      manager.notify(TAG, key.hashCode(), b.build())
      starts.remove(key)
    }

    Function("dismiss") { key: String ->
      starts.remove(key)
      manager.cancel(TAG, key.hashCode())
    }

    Function("dismissAll") {
      manager.activeNotifications.filter { it.tag == TAG }.forEach { manager.cancel(TAG, it.id) }
    }

    /** Opens the system screen where Live Updates can be allowed for afk (Android 16+). */
    Function("openSettings") {
      val intent = if (Build.VERSION.SDK_INT >= 36) {
        Intent(Settings.ACTION_APP_NOTIFICATION_PROMOTION_SETTINGS).putExtra(Settings.EXTRA_APP_PACKAGE, context.packageName)
      } else {
        Intent(Settings.ACTION_APP_NOTIFICATION_SETTINGS).putExtra(Settings.EXTRA_APP_PACKAGE, context.packageName)
      }
      context.startActivity(intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK))
    }
  }

  companion object {
    private val starts = HashMap<String, Long>()
    private const val STEP = 100
    private val ACCENT = 0xFF8FB8E8.toInt() // calm blue: working
    private val AMBER = 0xFFE3B868.toInt() // needs you (as in the app)
    private val DONE = 0xFFA8CC8C.toInt() // finished (as in the app)
    private const val CHANNEL = "live"
    private const val TAG = "afk-live"
    // Notification.EXTRA_REQUEST_PROMOTED_ONGOING (Android 16).
    private const val EXTRA_REQUEST_PROMOTED = "android.requestPromotedOngoing"
  }
}
