package dev.goafk.live

import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import android.net.Uri
import android.os.Build
import android.provider.Settings
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

/**
 * "Agent working" as an Android 16 Live Update: an ongoing, promoted notification with a
 * segmented progress bar (one segment per plan step) and a short status-bar chip ("2/5").
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

  override fun definition() = ModuleDefinition {
    Name("AfkLive")

    /** Whether the system will show promoted (status-bar) notifications from this app. */
    Function("canPromote") {
      if (Build.VERSION.SDK_INT >= 36) manager.canPostPromotedNotifications() else false
    }

    Function("supported") { Build.VERSION.SDK_INT >= 36 }

    /** Shows or updates the live notification for one thread. Returns whether it qualifies for promotion. */
    /** `promote`: ask for the status-bar chip (the user can turn that off in afk's Settings). */
    Function("show") { key: String, title: String, text: String, chip: String, done: Int, total: Int, url: String, promote: Boolean ->
      ensureChannel()
      val open = PendingIntent.getActivity(
        context,
        key.hashCode(),
        Intent(Intent.ACTION_VIEW, Uri.parse(url)).setPackage(context.packageName).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_SINGLE_TOP),
        PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE,
      )
      val b = Notification.Builder(context, CHANNEL)
        .setSmallIcon(smallIcon())
        .setContentTitle(title)
        .setContentText(text)
        .setContentIntent(open)
        .setOngoing(true)
        .setOnlyAlertOnce(true)
        .setShowWhen(false)
        .setCategory(Notification.CATEGORY_PROGRESS)
      if (Build.VERSION.SDK_INT >= 36) {
        val style = Notification.ProgressStyle().setStyledByProgress(true)
        if (total > 0) {
          for (i in 0 until total) style.addProgressSegment(Notification.ProgressStyle.Segment(1))
          style.setProgress(done.coerceIn(0, total))
        } else {
          style.setProgressIndeterminate(true)
        }
        b.setStyle(style)
        if (promote) {
          if (chip.isNotEmpty()) b.setShortCriticalText(chip)
          b.extras.putBoolean(EXTRA_REQUEST_PROMOTED, true)
        }
      } else if (total > 0) {
        b.setProgress(total, done.coerceIn(0, total), false)
      } else {
        b.setProgress(0, 0, true)
      }
      val n = b.build()
      manager.notify(TAG, key.hashCode(), n)
      if (Build.VERSION.SDK_INT >= 36) n.hasPromotableCharacteristics() else false
    }

    Function("dismiss") { key: String ->
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
    private const val CHANNEL = "live"
    private const val TAG = "afk-live"
    // Notification.EXTRA_REQUEST_PROMOTED_ONGOING (Android 16).
    private const val EXTRA_REQUEST_PROMOTED = "android.requestPromotedOngoing"
  }
}
