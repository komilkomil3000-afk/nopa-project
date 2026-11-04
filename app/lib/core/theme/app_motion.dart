import 'package:flutter/material.dart';

/// Shared motion tokens: one place for the durations and curves used by every animation in the app,
/// so the whole UI moves with the same rhythm. Frequent actions stay at or below 250 ms.
class AppMotion {
  AppMotion._();

  // Durations
  static const Duration press = Duration(milliseconds: 90);
  static const Duration pressRelease = Duration(milliseconds: 140);
  static const Duration fast = Duration(milliseconds: 150);
  static const Duration base = Duration(milliseconds: 200);
  static const Duration page = Duration(milliseconds: 260);
  static const Duration slow = Duration(milliseconds: 400);

  // Curves
  static const Curve enter = Curves.easeOutCubic;
  static const Curve exit = Curves.easeInCubic;

  /// True when the user asked the system to remove animations (accessibility / battery saver).
  static bool reduced(BuildContext context) => MediaQuery.maybeDisableAnimationsOf(context) ?? false;

  /// Returns [d], or [Duration.zero] when animations are disabled.
  static Duration dur(BuildContext context, Duration d) => reduced(context) ? Duration.zero : d;
}
