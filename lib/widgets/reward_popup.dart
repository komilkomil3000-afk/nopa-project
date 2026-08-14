import 'package:flutter/material.dart';
import 'package:confetti/confetti.dart';

class RewardPopup extends StatefulWidget {
  final String title;
  final int zarikAmount;
  final VoidCallback onDismiss;

  const RewardPopup({
    super.key,
    required this.title,
    required this.zarikAmount,
    required this.onDismiss,
  });

  static void show(BuildContext context, {String? title, String? message, required int zarikAmount, int? starAmount}) {
    showDialog(
      context: context,
      barrierDismissible: false,
      builder: (ctx) => RewardPopup(
        title: title ?? message ?? "",
        zarikAmount: zarikAmount,
        onDismiss: () => Navigator.pop(ctx),
      ),
    );
  }

  @override
  State<RewardPopup> createState() => _RewardPopupState();
}

class _RewardPopupState extends State<RewardPopup> {
  late ConfettiController _confettiController;

  @override
  void initState() {
    super.initState();
    _confettiController = ConfettiController(duration: const Duration(seconds: 3));
    WidgetsBinding.instance.addPostFrameCallback((_) {
      _confettiController.play();
    });
  }

  @override
  void dispose() {
    _confettiController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Dialog(
      backgroundColor: Colors.transparent,
      insetPadding: const EdgeInsets.all(20),
      child: Stack(
        alignment: Alignment.center,
        children: [
          // Background Card
          Container(
            padding: const EdgeInsets.all(24),
            decoration: BoxDecoration(
              color: Theme.of(context).colorScheme.surface,
              borderRadius: BorderRadius.circular(20),
              border: Border.all(color: const Color(0xFFFFD54F).withValues(alpha: 0.3), width: 2),
              boxShadow: [
                BoxShadow(
                  color: const Color(0xFFFFD54F).withValues(alpha: 0.1),
                  blurRadius: 20,
                  spreadRadius: 5,
                ),
              ],
            ),
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                const Icon(
                  Icons.stars_rounded,
                  color: Color(0xFFFFD54F),
                  size: 64,
                ),
                const SizedBox(height: 16),
                Text(
                  widget.title,
                  style: const TextStyle(
                    fontFamily: 'Vazirmatn',
                    fontSize: 22,
                    fontWeight: FontWeight.bold,
                  ),
                  textAlign: TextAlign.center,
                ),
                const SizedBox(height: 12),
                Text(
                  'شما ${widget.zarikAmount} زریک پاداش گرفتید!',
                  style: const TextStyle(
                    fontFamily: 'Vazirmatn',
                    fontSize: 16,
                    color: Color(0xFFFFD54F),
                  ),
                  textAlign: TextAlign.center,
                ),
                const SizedBox(height: 24),
                ElevatedButton(
                  onPressed: widget.onDismiss,
                  style: ElevatedButton.styleFrom(
                    backgroundColor: const Color(0xFFFFD54F),
                    foregroundColor: Colors.black,
                    shape: RoundedRectangleBorder(
                      borderRadius: BorderRadius.circular(12),
                    ),
                    padding: const EdgeInsets.symmetric(horizontal: 32, vertical: 12),
                  ),
                  child: const Text(
                    'عالیه!',
                    style: TextStyle(
                      fontFamily: 'Vazirmatn',
                      fontWeight: FontWeight.bold,
                      fontSize: 16,
                    ),
                  ),
                )
              ],
            ),
          ),
          // Confetti Layer
          ConfettiWidget(
            confettiController: _confettiController,
            blastDirectionality: BlastDirectionality.explosive, // radial blast
            shouldLoop: false,
            colors: const [
              Colors.amber,
              Colors.yellowAccent,
              Color(0xFFFFD54F),
              Colors.orange,
            ],
            createParticlePath: drawStar, 
          ),
        ],
      ),
    );
  }

  // Draw a star shape for the confetti
  Path drawStar(Size size) {
    // Basic 5-pointed star algorithm
    double degToRad(double deg) => deg * (3.141592653589793 / 180.0);
    const numberOfPoints = 5;
    final halfWidth = size.width / 2;
    final externalRadius = halfWidth;
    final internalRadius = halfWidth / 2.5;
    final degreesPerStep = degToRad(360 / numberOfPoints);
    final path = Path();
    final fullAngle = degToRad(360);
    path.moveTo(size.width, halfWidth);
    for (double step = 0; step < fullAngle; step += degreesPerStep) {
      path.lineTo(halfWidth + externalRadius * 1.0, halfWidth + externalRadius * 0);
      path.lineTo(
          halfWidth + internalRadius * 1.0, halfWidth + internalRadius * 0);
    }
    path.close();
    return path;
  }
}
