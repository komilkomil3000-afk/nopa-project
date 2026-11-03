import 'dart:math' as math;
import 'package:flutter/material.dart';

/// Amplitude bars of a voice message. Tap or drag on it to seek; [progress] is how much has been played.
///
/// A recording's bars travel with the file: [encodePeaks] packs them into the file name
/// (`voice-<time>~<bars>.m4a`) and [decodePeaks] reads them back on the listener's side, so no server
/// field is needed. Voices without bars (older ones) get a stable stand-in shape from [pseudoPeaks].
class ChatWaveform extends StatelessWidget {
  /// Bars drawn for a message.
  static const int barCount = 40;

  final List<double> peaks;
  final double progress;
  final Color activeColor;
  final Color idleColor;
  final double height;

  /// A tap, or the end of a drag: the fraction (0..1) of the audio to continue from.
  final ValueChanged<double>? onSeek;

  /// While dragging: the fraction under the finger.
  final ValueChanged<double>? onScrub;

  const ChatWaveform({
    super.key,
    required this.peaks,
    required this.progress,
    required this.activeColor,
    required this.idleColor,
    this.height = 34,
    this.onSeek,
    this.onScrub,
  });

  double _fraction(double dx, double width) => width <= 0 ? 0 : (dx / width).clamp(0.0, 1.0);

  @override
  Widget build(BuildContext context) {
    // The timeline always runs left to right, whatever the language of the chat
    return Directionality(
      textDirection: TextDirection.ltr,
      child: LayoutBuilder(
        builder: (context, box) {
          final width = box.maxWidth;
          return GestureDetector(
            behavior: HitTestBehavior.opaque,
            onTapUp: onSeek == null ? null : (d) => onSeek!(_fraction(d.localPosition.dx, width)),
            onHorizontalDragUpdate: onScrub == null ? null : (d) => onScrub!(_fraction(d.localPosition.dx, width)),
            onHorizontalDragEnd: onSeek == null
                ? null
                : (_) => onSeek!(progress.clamp(0.0, 1.0)),
            child: SizedBox(
              height: height,
              width: double.infinity,
              child: CustomPaint(
                painter: _WaveformPainter(peaks: peaks, progress: progress.clamp(0.0, 1.0), active: activeColor, idle: idleColor),
              ),
            ),
          );
        },
      ),
    );
  }

  // ---- bars: building, packing, unpacking ----

  /// Reduces raw 0..1 levels to [bars] values, each the loudest of its slice, then stretches the quietest
  /// to a visible minimum so a silent recording still shows a line.
  static List<double> downsample(List<double> levels, {int bars = barCount}) {
    if (levels.isEmpty) return List<double>.filled(bars, 0.08);
    final out = <double>[];
    for (var i = 0; i < bars; i++) {
      final from = (i * levels.length / bars).floor();
      final to = math.max(from + 1, ((i + 1) * levels.length / bars).ceil()).clamp(from + 1, levels.length);
      var peak = 0.0;
      for (var j = from; j < to; j++) {
        if (levels[j] > peak) peak = levels[j];
      }
      out.add(math.max(0.08, peak.clamp(0.0, 1.0)));
    }
    return out;
  }

  static const String _alphabet = '0123456789abcdefghijklmnopqrstuvwxyz';

  /// One base-36 character per bar.
  static String encodePeaks(List<double> peaks) => peaks
      .map((p) => _alphabet[(p.clamp(0.0, 1.0) * (_alphabet.length - 1)).round()])
      .join();

  static final RegExp _inName = RegExp(r'~([0-9a-z]{16,64})\.[A-Za-z0-9]+$');

  /// The bars packed into a file name by [encodePeaks], or null when the name carries none.
  static List<double>? decodePeaks(String? fileName) {
    final match = _inName.firstMatch(fileName ?? '');
    if (match == null) return null;
    return match.group(1)!.split('').map((c) => _alphabet.indexOf(c) / (_alphabet.length - 1)).toList();
  }

  /// A stable, natural-looking shape for a voice that has no recorded bars; the same seed gives the same bars.
  static List<double> pseudoPeaks(String seed, {int bars = barCount}) {
    var state = seed.codeUnits.fold<int>(2166136261, (h, c) => ((h ^ c) * 16777619) & 0x7fffffff);
    if (state == 0) state = 1;
    final out = <double>[];
    var previous = 0.5;
    for (var i = 0; i < bars; i++) {
      state = (state * 1103515245 + 12345) & 0x7fffffff;
      final random = (state % 1000) / 1000;
      // Neighbouring bars lean on each other, so the shape swells and falls instead of jittering
      previous = (previous * 0.55 + random * 0.45).clamp(0.0, 1.0);
      out.add(0.18 + previous * 0.82);
    }
    return out;
  }
}

class _WaveformPainter extends CustomPainter {
  final List<double> peaks;
  final double progress;
  final Color active;
  final Color idle;

  _WaveformPainter({required this.peaks, required this.progress, required this.active, required this.idle});

  @override
  void paint(Canvas canvas, Size size) {
    final count = peaks.length;
    if (count == 0) return;
    const gapRatio = 0.7;
    final barWidth = size.width / (count + (count - 1) * gapRatio);
    final gap = barWidth * gapRatio;
    final radius = Radius.circular(barWidth / 2);
    final paint = Paint();
    for (var i = 0; i < count; i++) {
      final left = i * (barWidth + gap);
      final h = math.max(3.0, peaks[i].clamp(0.0, 1.0) * size.height);
      final rect = RRect.fromRectAndRadius(Rect.fromLTWH(left, (size.height - h) / 2, barWidth, h), radius);
      // A bar counts as played once the progress has passed its middle
      paint.color = (left + barWidth / 2) / size.width <= progress ? active : idle;
      canvas.drawRRect(rect, paint);
    }
  }

  @override
  bool shouldRepaint(_WaveformPainter old) => old.progress != progress || old.peaks != peaks || old.active != active || old.idle != idle;
}
