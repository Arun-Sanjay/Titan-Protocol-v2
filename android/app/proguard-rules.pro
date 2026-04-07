# Add project specific ProGuard rules here.
# By default, the flags in this file are appended to flags specified
# in /usr/local/Cellar/android-sdk/24.3.3/tools/proguard/proguard-android.txt
# You can edit the include path and order by changing the proguardFiles
# directive in build.gradle.
#
# For more details, see
#   http://developer.android.com/guide/developing/tools/proguard.html

# react-native-reanimated
-keep class com.swmansion.reanimated.** { *; }
-keep class com.facebook.react.turbomodule.** { *; }

# expo-av (FullscreenVideoPlayer.KeepScreenOnUpdater) references
# expo.modules.core.interfaces.services.KeepAwakeManager which lives
# in the older expo-modules-core API surface. R8 strips it during
# minify because no Java/Kotlin code references it directly — only
# the reflective DI lookup inside expo-av's video player. Without
# this rule, `:app:minifyReleaseWithR8` fails with:
#   ERROR: R8: Missing class
#   expo.modules.core.interfaces.services.KeepAwakeManager
# Keep the entire interfaces.services package since it's the public
# DI contract and removing any one of them breaks reflection lookups
# in other expo modules too.
-keep class expo.modules.core.interfaces.services.** { *; }
-dontwarn expo.modules.core.interfaces.services.**
-dontwarn expo.modules.av.**

# expo-modules-core / expo autolinking — keep the bridge interfaces
# that runtime DI relies on but R8 can't trace via static analysis.
-keep class expo.modules.core.interfaces.** { *; }
-keep class expo.modules.kotlin.** { *; }
-dontwarn expo.modules.kotlin.**

# Add any project specific keep options here:
