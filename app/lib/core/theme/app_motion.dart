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

/// The app's page transition: a short slide + fade along the reading direction (RTL aware), with a light
/// parallax on the page underneath. Runs on the compositor (Fade/SlideTransition only), so no relayout.
class NopaPageTransitionsBuilder extends PageTransitionsBuilder {
  const NopaPageTransitionsBuilder();

  @override
  Duration get transitionDuration => AppMotion.page;

  @override
  Widget buildTransitions<T>(
    PageRoute<T> route,
    BuildContext context,
    Animation<double> animation,
    Animation<double> secondaryAnimation,
    Widget child,
  ) {
    if (AppMotion.reduced(context)) return child;

    // Forward navigation enters from the start of the reading direction's far end: from the left in RTL.
    final double sign = Directionality.of(context) == TextDirection.rtl ? -1 : 1;

    final incoming = animation
        .drive(CurveTween(curve: AppMotion.enter))
        .drive(Tween(begin: Offset(0.25 * sign, 0), end: Offset.zero));
    final outgoing = secondaryAnimation
        .drive(CurveTween(curve: AppMotion.enter))
        .drive(Tween(begin: Offset.zero, end: Offset(-0.08 * sign, 0)));

    return SlideTransition(
      position: outgoing,
      child: FadeTransition(
        opacity: animation.drive(CurveTween(curve: AppMotion.enter)),
        child: SlideTransition(position: incoming, child: child),
      ),
    );
  }
}
