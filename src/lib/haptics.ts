// Light haptic feedback for the moments that matter. Builds from before expo-haptics have no native
// module (an OTA update can still reach them): the calls reject there, and we ignore that.
import * as Haptics from "expo-haptics";

const quiet = () => {};

export const haptic = {
  /** A message sent, a sheet flicked away. */
  tap: () => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(quiet),
  /** Something done: permission answered, all marked read. */
  success: () => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(quiet),
  /** A swipe action crossing its threshold. */
  select: () => Haptics.selectionAsync().catch(quiet),
};
