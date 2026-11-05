import 'dart:io' as io;

import 'package:flutter/material.dart' hide Text;
import 'package:nopa_app/widgets/fa_text.dart';
import 'package:video_player/video_player.dart';

import '../../core/theme/app_colors.dart';
import '../../services/audio_exclusivity_service.dart';

/// Plays one chat video inside the app (a link or a file still on the device), full screen.
class ChatVideoPage extends StatefulWidget {
  final String? url;
  final io.File? file;
  final String title;

  const ChatVideoPage({super.key, this.url, this.file, this.title = 'ویدیو'}) : assert(url != null || file != null);

  @override
  State<ChatVideoPage> createState() => _ChatVideoPageState();
}

class _ChatVideoPageState extends State<ChatVideoPage> {
  VideoPlayerController? _controller;
  bool _failed = false;

  @override
  void initState() {
    super.initState();
    _start();
  }

  Future<void> _start() async {
    setState(() => _failed = false);
    final c = widget.file != null ? VideoPlayerController.file(widget.file!) : VideoPlayerController.networkUrl(Uri.parse(widget.url!));
    _controller = c;
    try {
      await c.initialize();
      if (!mounted || _controller != c) return;
      c.addListener(() {
        if (mounted) setState(() {});
      });
      AudioExclusivityService.registerVideoController(c);
      await c.play();
      AudioExclusivityService.onVideoPlay();
      setState(() {});
    } catch (_) {
      if (mounted) setState(() => _failed = true);
    }
  }

  @override
  void dispose() {
    final c = _controller;
    _controller = null;
    if (c != null) {
      try {
        AudioExclusivityService.unregisterVideoController(c);
        c.dispose();
      } catch (_) {}
    }
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final c = _controller;
    final ready = c != null && c.value.isInitialized;
    return Directionality(
      textDirection: TextDirection.ltr,
      child: Scaffold(
        backgroundColor: Colors.black,
        appBar: AppBar(
          backgroundColor: Colors.black,
          foregroundColor: Colors.white,
          title: Text(widget.title, maxLines: 1, overflow: TextOverflow.ellipsis, style: const TextStyle(color: Colors.white, fontSize: 14)),
        ),
        body: _failed
            ? Center(
                child: Column(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    const Icon(Icons.error_outline_rounded, color: Color(0xFFEF4444), size: 40),
                    const SizedBox(height: 8),
                    const Text('پخش ویدیو انجام نشد. اتصال اینترنت را بررسی کنید.', style: TextStyle(color: Colors.white)),
                    const SizedBox(height: 12),
                    ElevatedButton(onPressed: _start, child: const Text('تلاش دوباره')),
                  ],
                ),
              )
            : !ready
                ? const Center(child: CircularProgressIndicator(color: AppColors.buttonCamel))
                : Column(
                    children: [
                      Expanded(
                        child: GestureDetector(
                          onTap: () => c.value.isPlaying ? c.pause() : c.play(),
                          child: Center(
                            child: AspectRatio(
                              aspectRatio: c.value.aspectRatio > 0 ? c.value.aspectRatio : 16 / 9,
                              child: Stack(
                                alignment: Alignment.center,
                                children: [
                                  VideoPlayer(c),
                                  if (!c.value.isPlaying) const Icon(Icons.play_circle_fill_rounded, color: Colors.white70, size: 64),
                                ],
                              ),
                            ),
                          ),
                        ),
                      ),
                      Padding(
                        padding: const EdgeInsets.fromLTRB(12, 4, 12, 16),
                        child: SafeArea(
                          top: false,
                          child: VideoProgressIndicator(
                            c,
                            allowScrubbing: true,
                            padding: const EdgeInsets.symmetric(vertical: 10),
                            colors: const VideoProgressColors(playedColor: AppColors.buttonCamel, bufferedColor: Colors.white24, backgroundColor: Colors.white12),
                          ),
                        ),
                      ),
                    ],
                  ),
      ),
    );
  }
}
