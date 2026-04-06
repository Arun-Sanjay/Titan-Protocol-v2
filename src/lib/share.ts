/**
 * View capture and sharing via react-native-view-shot + expo-sharing
 */

import type { RefObject } from "react";
import type { View } from "react-native";
import { captureRef } from "react-native-view-shot";
import * as Sharing from "expo-sharing";

/**
 * Capture a React Native view as an image and open the native share sheet.
 */
export async function captureAndShare(viewRef: RefObject<View | null>): Promise<void> {
  try {
    if (!viewRef.current) return;

    const uri = await captureRef(viewRef, {
      format: "png",
      quality: 1,
      result: "tmpfile",
    });

    const available = await Sharing.isAvailableAsync();
    if (!available) return;

    await Sharing.shareAsync(uri, {
      mimeType: "image/png",
      dialogTitle: "Share your achievement",
    });
  } catch {
    // Silently fail — sharing is optional
  }
}
