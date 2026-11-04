import 'dart:math' as math;
import 'package:confetti/confetti.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import '../core/theme/app_motion.dart';

/// One-shot reward celebration: a short, restrained confetti burst in the app's gold/lavender palette
/// plus a haptic tap. Reserve it for real milestones (a reward actually earned); it is not for routine taps.
///
/// The burst lives in a temporary overlay entry (ignores touches, removed after ~1.4 s) and its controller
/// is disposed with it, so nothing keeps running afterwards. Does nothing visual when animations are off.
class NopaCelebration {
  NopaCelebration._();

  static void show(BuildContext context) {
    HapticFeedback.mediumImpact();
    if (AppMotion.reduced(context)) return;
    final overlay = Overlay.maybeOf(context, rootOverlay: true);
    if (overlay == null) return;

    final controller = ConfettiController(duration: const Duration(milliseconds: 700));
    late final OverlayEntry entry;
    entry = OverlayEntry(
      builder: (_) => IgnorePointer(
        child: Align(
          alignment: const Alignment(0, -0.3),
          child: ConfettiWidget(
            confettiController: controller,
            blastDirection: -math.pi / 2,
            blastDirectionality: BlastDirectionality.explosive,
            emissionFrequency: 0.06,
            numberOfParticles: 10,
            maxBlastForce: 18,
            minBlastForce: 8,
            gravity: 0.35,
            shouldLoop: false,
            colors: const [Color(0xFFDFB690), Color(0xFFE5A133), Color(0xFF9292E2), Color(0xFFEDE9F6)],
          ),
        ),
      ),
    );
    overlay.insert(entry);
    controller.play();
    Future<void>.delayed(const Duration(milliseconds: 1600), () {
      entry.remove();
      controller.dispose();
    });
  }
}
