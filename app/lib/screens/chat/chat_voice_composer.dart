import 'package:nopa_app/widgets/nopa_modal_shell.dart';
import 'dart:async';
import 'dart:io' as io;
import 'package:flutter/material.dart' hide Text;
import 'package:nopa_app/core/theme/app_colors.dart';
import 'package:nopa_app/core/theme/app_typography.dart';
import 'package:nopa_app/screens/chat/chat_message_bubble.dart';
import 'package:nopa_app/screens/chat/chat_theme.dart';
import 'package:nopa_app/screens/chat/chat_topic_info_screen.dart';
import 'package:nopa_app/screens/chat/chat_waveform.dart';
import 'package:nopa_app/widgets/app_toast.dart';
import 'package:nopa_app/widgets/fa_text.dart';
import 'package:path/path.dart' as p;
import 'package:path_provider/path_provider.dart';
import 'package:record/record.dart';

/// Where a voice message stands in the composer.
enum _VoicePhase { starting, recording, saving, staged }

/// The composer bar while a voice message is made, in two steps:
///  1. **Recording**, at most [maxDuration]: a live waveform and a timer. Pausing (or the limit) does not send;
///     it saves the clip into the staging step.
///  2. **Staging**: the clip can be played (and scrubbed), deleted, given a caption, and only then sent,
///     after the user confirms.
///
/// [onSend] uploads and sends; it returns whether that worked. On success the owner closes the composer.
class ChatVoiceComposer extends StatefulWidget {
  static const Duration maxDuration = Duration(seconds: 60);

  final Future<bool> Function(io.File file, String caption) onSend;
  final VoidCallback onClose;
  const ChatVoiceComposer({super.key, required this.onSend, required this.onClose});

  @override
  State<ChatVoiceComposer> createState() => _ChatVoiceComposerState();
}

class _ChatVoiceComposerState extends State<ChatVoiceComposer> {
  /// Recordings shorter than this are taken for an accidental tap and dropped.
  static const Duration _minDuration = Duration(milliseconds: 800);

  /// How many recent levels the live waveform shows.
  static const int _liveBars = 34;

  final AudioRecorder _recorder = AudioRecorder();
  final TextEditingController _caption = TextEditingController();
  final List<double> _levels = [];
  StreamSubscription<Amplitude>? _amplitudes;
  Timer? _ticker;

  _VoicePhase _phase = _VoicePhase.starting;
  DateTime _startedAt = DateTime.now();
  int _stamp = 0;
  Duration _elapsed = Duration.zero;
  io.File? _file;
  List<double> _peaks = const [];
  bool _sending = false;

  @override
  void initState() {
    super.initState();
    _start();
  }

  @override
  void dispose() {
    _ticker?.cancel();
    _amplitudes?.cancel();
    if (_phase == _VoicePhase.recording || _phase == _VoicePhase.starting) {
      _recorder.cancel();
    }
    _recorder.dispose();
    _caption.dispose();
    super.dispose();
  }

  Future<void> _start() async {
    try {
      if (!await _recorder.hasPermission()) {
        if (mounted) AppToast.error(context, 'برای ضبط صدا، اجازه‌ی میکروفون لازم است.');
        widget.onClose();
        return;
      }
      final dir = await getTemporaryDirectory();
      _stamp = DateTime.now().millisecondsSinceEpoch;
      await _recorder.start(const RecordConfig(encoder: AudioEncoder.aacLc, bitRate: 48000), path: p.join(dir.path, 'voice-$_stamp.m4a'));
      if (!mounted) return;
      _startedAt = DateTime.now();
      // Speech sits roughly between -50 and 0 dB; spread that over 0..1
      _amplitudes = _recorder.onAmplitudeChanged(const Duration(milliseconds: 100)).listen((a) => _levels.add(((a.current + 50) / 50).clamp(0.0, 1.0)));
      _ticker = Timer.periodic(const Duration(milliseconds: 100), _onTick);
      setState(() => _phase = _VoicePhase.recording);
    } catch (e) {
      debugPrint('Voice recording start error: $e');
      if (mounted) AppToast.error(context, 'ضبط صدا شروع نشد.');
      widget.onClose();
    }
  }

  void _onTick(Timer _) {
    final elapsed = DateTime.now().difference(_startedAt);
    if (elapsed >= ChatVoiceComposer.maxDuration) {
      _stage();
      return;
    }
    if (mounted) setState(() => _elapsed = elapsed);
  }

  /// Ends the recording and keeps it for review; nothing is sent.
  Future<void> _stage() async {
    if (_phase != _VoicePhase.recording) return;
    setState(() => _phase = _VoicePhase.saving);
    _ticker?.cancel();
    await _amplitudes?.cancel();
    final elapsed = DateTime.now().difference(_startedAt);
    final duration = elapsed > ChatVoiceComposer.maxDuration ? ChatVoiceComposer.maxDuration : elapsed;
    final path = await _recorder.stop();
    if (!mounted) return;
    if (path == null || duration < _minDuration) {
      if (path != null) io.File(path).delete().ignore();
      AppToast.info(context, 'ضبط خیلی کوتاه بود.');
      widget.onClose();
      return;
    }
    final peaks = ChatWaveform.downsample(_levels);
    // The bars go with the file, in its name, so the listener's player can draw the same waveform
    var file = io.File(path);
    try {
      file = await file.rename(p.join(p.dirname(path), 'voice-$_stamp~${ChatWaveform.encodePeaks(peaks)}.m4a'));
    } catch (e) {
      debugPrint('Voice rename error: $e');
    }
    if (!mounted) return;
    setState(() {
      _file = file;
      _peaks = peaks;
      _elapsed = duration;
      _phase = _VoicePhase.staged;
    });
  }

  Future<void> _discard() async {
    _ticker?.cancel();
    if (_phase == _VoicePhase.recording || _phase == _VoicePhase.starting) await _recorder.cancel();
    final file = _file;
    widget.onClose();
    // After closing, so a preview that is playing is gone before its file is
    if (file != null) file.delete().ignore();
  }

  Future<void> _confirmAndSend() async {
    final file = _file;
    if (file == null || _sending) return;
    final ok = await showNopaDialog<bool>(
      context: context,
      builder: (ctx) => Directionality(
        textDirection: TextDirection.rtl,
        child: AlertDialog(
          backgroundColor: ChatTheme.surfaceBottom,
          shape: ChatTheme.dialogShape,
          content: Text('آیا از ارسال پیام مطمئن هستید؟', style: ChatTheme.body),
          actions: [
            ChatButton(label: 'انصراف', primary: false, onPressed: () => Navigator.pop(ctx, false)),
            ChatButton(label: 'ارسال', onPressed: () => Navigator.pop(ctx, true)),
          ],
        ),
      ),
    );
    if (ok != true || !mounted) return;
    setState(() => _sending = true);
    final sent = await widget.onSend(file, _caption.text);
    if (mounted && !sent) setState(() => _sending = false);
  }

  static String _clock(Duration d) {
    final minutes = d.inMinutes.remainder(60).toString().padLeft(2, '0');
    final seconds = d.inSeconds.remainder(60).toString().padLeft(2, '0');
    return '$minutes:$seconds';
  }

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.fromLTRB(6, 4, 6, 4),
      child: Directionality(
        textDirection: TextDirection.rtl,
        child: _phase == _VoicePhase.staged ? _staged() : _recording(),
      ),
    );
  }

  Widget _recording() {
    final ink = ChatTheme.ink.withValues(alpha: 0.7);
    final remaining = ChatVoiceComposer.maxDuration - _elapsed;
    final nearLimit = remaining <= const Duration(seconds: 10);
    final recent = _levels.length > _liveBars ? _levels.sublist(_levels.length - _liveBars) : _levels;
    final bars = [for (var i = 0; i < _liveBars - recent.length; i++) 0.08, ...recent.map((l) => l < 0.08 ? 0.08 : l)];
    final busy = _phase != _VoicePhase.recording;
    return Row(
      children: [
        IconButton(
          tooltip: 'حذف',
          onPressed: _phase == _VoicePhase.saving ? null : _discard,
          icon: Icon(Icons.delete_outline_rounded, color: ink, size: 24),
        ),
        const SizedBox(width: 2),
        Container(width: 9, height: 9, decoration: const BoxDecoration(color: ChatTheme.danger, shape: BoxShape.circle)),
        const SizedBox(width: 8),
        Directionality(
          textDirection: TextDirection.ltr,
          child: Text(
            '${_clock(_elapsed)} / ${_clock(ChatVoiceComposer.maxDuration)}',
            style: AppTypography.bodyMedium.copyWith(color: nearLimit ? ChatTheme.danger : ChatTheme.ink, fontWeight: FontWeight.w600, fontSize: 12.5),
          ),
        ),
        const SizedBox(width: 10),
        Expanded(
          child: ChatWaveform(
            peaks: bars,
            progress: 1,
            activeColor: ChatTheme.danger.withValues(alpha: 0.85),
            idleColor: ChatTheme.danger.withValues(alpha: 0.25),
            height: 28,
          ),
        ),
        const SizedBox(width: 6),
        Tooltip(
          message: 'توقف و پیش‌نمایش',
          child: Material(
            color: ChatTheme.accent,
            shape: const CircleBorder(),
            child: InkWell(
              customBorder: const CircleBorder(),
              onTap: busy ? null : _stage,
              child: SizedBox(
                width: 40,
                height: 40,
                child: busy
                    ? const Padding(padding: EdgeInsets.all(11), child: CircularProgressIndicator(strokeWidth: 2, color: ChatTheme.ink))
                    : const Icon(Icons.pause_rounded, color: ChatTheme.ink, size: 22),
              ),
            ),
          ),
        ),
      ],
    );
  }

  Widget _staged() {
    final ink = ChatTheme.ink.withValues(alpha: 0.7);
    final file = _file!;
    return Column(
      mainAxisSize: MainAxisSize.min,
      children: [
        Row(
          children: [
            IconButton(
              tooltip: 'حذف',
              onPressed: _sending ? null : _discard,
              icon: Icon(Icons.delete_outline_rounded, color: ink, size: 24),
            ),
            Expanded(
              child: ChatAudioPlayer(
                url: '',
                filePath: file.path,
                peaks: _peaks,
                color: ChatTheme.goldTitle,
                width: double.infinity,
              ),
            ),
          ],
        ),
        Row(
          crossAxisAlignment: CrossAxisAlignment.end,
          children: [
            Expanded(
              child: TextField(
                controller: _caption,
                enabled: !_sending,
                minLines: 1,
                maxLines: 3,
                maxLength: 300,
                cursorColor: AppColors.buttonCamel,
                style: AppTypography.bodyLarge.copyWith(color: ChatTheme.ink),
                decoration: InputDecoration(
                  counterText: '',
                  isDense: true,
                  border: InputBorder.none,
                  contentPadding: const EdgeInsets.fromLTRB(12, 12, 8, 12),
                  hintText: 'توضیح برای پیام صوتی (اختیاری)...',
                  hintStyle: AppTypography.bodyMedium.copyWith(fontSize: 13, color: ChatTheme.ink.withValues(alpha: 0.45)),
                ),
              ),
            ),
            Padding(
              padding: const EdgeInsets.all(4),
              child: Material(
                color: ChatTheme.accent,
                shape: const CircleBorder(),
                child: InkWell(
                  customBorder: const CircleBorder(),
                  onTap: _sending ? null : _confirmAndSend,
                  child: SizedBox(
                    width: 40,
                    height: 40,
                    child: _sending
                        ? const Padding(padding: EdgeInsets.all(11), child: CircularProgressIndicator(strokeWidth: 2, color: ChatTheme.ink))
                        // The arrow points right, the way a message leaves in a right-to-left chat
                        : const Directionality(textDirection: TextDirection.ltr, child: Icon(Icons.send_rounded, color: ChatTheme.ink, size: 20)),
                  ),
                ),
              ),
            ),
          ],
        ),
      ],
    );
  }
}
