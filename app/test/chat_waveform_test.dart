import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:nopa_app/screens/chat/chat_waveform.dart';

void main() {
  group('ChatWaveform bars', () {
    test('downsample gives the asked number of bars, loudest of each slice, never below the minimum', () {
      final levels = List<double>.generate(200, (i) => i == 50 ? 0.9 : 0.0);
      final bars = ChatWaveform.downsample(levels, bars: 40);
      expect(bars.length, 40);
      expect(bars.reduce((a, b) => a > b ? a : b), closeTo(0.9, 1e-9));
      expect(bars.every((b) => b >= 0.08), isTrue);
    });

    test('downsample of nothing is a flat, visible line', () {
      final bars = ChatWaveform.downsample(const [], bars: 10);
      expect(bars, List<double>.filled(10, 0.08));
    });

    test('bars survive the trip through a file name', () {
      final bars = List<double>.generate(ChatWaveform.barCount, (i) => (i % 10) / 9);
      final packed = ChatWaveform.encodePeaks(bars);
      expect(packed.length, ChatWaveform.barCount);
      final decoded = ChatWaveform.decodePeaks('voice-1730000000000~$packed.m4a');
      expect(decoded, isNotNull);
      expect(decoded!.length, bars.length);
      for (var i = 0; i < bars.length; i++) {
        // One of 36 levels per bar
        expect(decoded[i], closeTo(bars[i], 1 / 35));
      }
    });

    test('a name without bars, or with too few, gives none', () {
      expect(ChatWaveform.decodePeaks('voice-1730000000000.m4a'), isNull);
      expect(ChatWaveform.decodePeaks('holiday~abc.m4a'), isNull);
      expect(ChatWaveform.decodePeaks(null), isNull);
    });

    test('a stand-in shape is stable per seed and differs between seeds', () {
      final a = ChatWaveform.pseudoPeaks('message-1');
      final b = ChatWaveform.pseudoPeaks('message-1');
      final c = ChatWaveform.pseudoPeaks('message-2');
      expect(a, b);
      expect(a, isNot(c));
      expect(a.length, ChatWaveform.barCount);
      expect(a.every((v) => v >= 0.18 && v <= 1.0), isTrue);
    });
  });

  group('ChatWaveform gestures', () {
    Widget host(ValueChanged<double> onSeek, ValueChanged<double> onScrub) => MaterialApp(
          home: Scaffold(
            body: Center(
              child: SizedBox(
                width: 200,
                child: ChatWaveform(
                  peaks: ChatWaveform.pseudoPeaks('x'),
                  progress: 0.25,
                  activeColor: Colors.red,
                  idleColor: Colors.grey,
                  onSeek: onSeek,
                  onScrub: onScrub,
                ),
              ),
            ),
          ),
        );

    testWidgets('a tap seeks to the tapped fraction, left to right', (tester) async {
      double? seek;
      await tester.pumpWidget(host((f) => seek = f, (_) {}));
      final box = tester.getRect(find.byType(ChatWaveform));
      await tester.tapAt(Offset(box.left + box.width * 0.75, box.center.dy));
      expect(seek, closeTo(0.75, 0.02));
      await tester.tapAt(Offset(box.left + box.width * 0.1, box.center.dy));
      expect(seek, closeTo(0.1, 0.02));
    });

    testWidgets('dragging reports the fraction under the finger and ends with a seek', (tester) async {
      final scrubs = <double>[];
      double? seek;
      await tester.pumpWidget(host((f) => seek = f, scrubs.add));
      final box = tester.getRect(find.byType(ChatWaveform));
      final gesture = await tester.startGesture(Offset(box.left + box.width * 0.2, box.center.dy));
      await gesture.moveTo(Offset(box.left + box.width * 0.6, box.center.dy));
      await gesture.moveTo(Offset(box.left + box.width * 0.9, box.center.dy));
      await gesture.up();
      expect(scrubs, isNotEmpty);
      expect(scrubs.last, closeTo(0.9, 0.03));
      expect(seek, isNotNull);
    });
  });
}
