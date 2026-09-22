import 'dart:async';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_svg/flutter_svg.dart';
import 'package:video_player/video_player.dart';
import 'package:cached_network_image/cached_network_image.dart';
import '../services/aparat_service.dart';
import '../services/audio_exclusivity_service.dart';
import '../core/theme/app_theme.dart';

class NopaInlineVideoPlayer extends StatefulWidget {
  final String videoUrl;
  final String? title;
  final String? coverImageUrl;
  final bool autoPlay;

  const NopaInlineVideoPlayer({
    super.key,
    required this.videoUrl,
    this.title,
    this.coverImageUrl,
    this.autoPlay = false,
  });

  @override
  State<NopaInlineVideoPlayer> createState() => _NopaInlineVideoPlayerState();
}

class _NopaInlineVideoPlayerState extends State<NopaInlineVideoPlayer> {
  VideoPlayerController? _controller;
  bool _isInitialized = false;
  bool _isLoading = false;
  bool _hasError = false;
  bool _isPlaying = false;
  bool _showControls = true;
  Timer? _controlsTimer;

  AparatVideoInfo? _aparatInfo;
  String? _selectedQuality;
  double _playbackSpeed = 1.0;

  @override
  void initState() {
    super.initState();
    if (widget.autoPlay) {
      _startVideo();
    }
  }

  @override
  void didUpdateWidget(covariant NopaInlineVideoPlayer oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (oldWidget.videoUrl != widget.videoUrl) {
      _disposeController();
      setState(() {
        _isInitialized = false;
        _hasError = false;
        _isPlaying = false;
      });
      if (widget.autoPlay) {
        _startVideo();
      }
    }
  }

  @override
  void dispose() {
    _controlsTimer?.cancel();
    _disposeController();
    super.dispose();
  }

  void _disposeController() {
    final c = _controller;
    if (c != null) {
      _controller = null;
      try {
        c.removeListener(_videoListener);
        AudioExclusivityService.unregisterVideoController(c);
        c.dispose();
      } catch (_) {}
    }
  }

  void _videoListener() {
    if (!mounted || _controller == null) return;
    final value = _controller!.value;
    if (value.isPlaying != _isPlaying) {
      setState(() {
        _isPlaying = value.isPlaying;
      });
    }
    if (value.hasError) {
      setState(() {
        _hasError = true;
        _isLoading = false;
      });
    }
  }

  void _resetControlsTimer() {
    _controlsTimer?.cancel();
    if (_showControls && _isPlaying) {
      _controlsTimer = Timer(const Duration(seconds: 4), () {
        if (mounted && _isPlaying) {
          setState(() {
            _showControls = false;
          });
        }
      });
    }
  }

  void _toggleControls() {
    setState(() {
      _showControls = !_showControls;
    });
    if (_showControls) {
      _resetControlsTimer();
    }
  }

  Future<void> _startVideo({String? overrideUrl, int seekSeconds = 0}) async {
    setState(() {
      _isLoading = true;
      _hasError = false;
    });

    String targetStreamUrl = overrideUrl ?? widget.videoUrl;

    // Check if URL is Aparat
    if (targetStreamUrl.contains('aparat.com') || !targetStreamUrl.endsWith('.mp4')) {
      final info = await AparatService.resolveAparatVideo(targetStreamUrl);
      if (info != null) {
        _aparatInfo = info;
        if (_selectedQuality != null && info.qualities.containsKey(_selectedQuality)) {
          targetStreamUrl = info.qualities[_selectedQuality]!;
        } else {
          targetStreamUrl = info.defaultUrl;
          _selectedQuality = info.qualities.entries
              .firstWhere((e) => e.value == info.defaultUrl, orElse: () => info.qualities.entries.first)
              .key;
        }
      }
    }

    _disposeController();

    try {
      final uri = Uri.parse(targetStreamUrl);
      final newController = VideoPlayerController.networkUrl(uri);
      _controller = newController;

      await newController.initialize();
      if (!mounted || _controller != newController) {
        newController.dispose();
        return;
      }

      newController.addListener(_videoListener);
      AudioExclusivityService.registerVideoController(newController);
      await newController.setPlaybackSpeed(_playbackSpeed);

      if (seekSeconds > 0) {
        await newController.seekTo(Duration(seconds: seekSeconds));
      }

      await newController.play();
      AudioExclusivityService.onVideoPlay();

      if (mounted) {
        setState(() {
          _isInitialized = true;
          _isLoading = false;
          _isPlaying = true;
          _showControls = true;
        });
        _resetControlsTimer();
      }
    } catch (e) {
      debugPrint('Error starting inline video: $e');
      if (mounted) {
        setState(() {
          _isLoading = false;
          _hasError = true;
        });
      }
    }
  }

  void _changeQuality(String quality, String url) {
    final currentPos = _controller?.value.position.inSeconds ?? 0;
    setState(() {
      _selectedQuality = quality;
    });
    _startVideo(overrideUrl: url, seekSeconds: currentPos);
  }

  void _changeSpeed(double speed) {
    setState(() {
      _playbackSpeed = speed;
    });
    _controller?.setPlaybackSpeed(speed);
  }

  void _skipSeconds(int deltaSeconds) {
    if (_controller == null || !_isInitialized) return;
    final currentPos = _controller!.value.position;
    final totalDur = _controller!.value.duration;
    final newPos = currentPos + Duration(seconds: deltaSeconds);
    final clamped = newPos < Duration.zero
        ? Duration.zero
        : (newPos > totalDur ? totalDur : newPos);
    _controller!.seekTo(clamped);
    _resetControlsTimer();
  }

  String _formatDuration(Duration duration) {
    final minutes = duration.inMinutes.remainder(60).toString().padLeft(2, '0');
    final seconds = duration.inSeconds.remainder(60).toString().padLeft(2, '0');
    if (duration.inHours > 0) {
      final hours = duration.inHours.toString().padLeft(2, '0');
      return '$hours:$minutes:$seconds';
    }
    return '$minutes:$seconds';
  }

  void _openFullscreen() {
    if (_controller == null) return;
    _controlsTimer?.cancel();

    Navigator.push(
      context,
      MaterialPageRoute(
        builder: (ctx) => _FullscreenVideoPage(
          controller: _controller!,
          aparatInfo: _aparatInfo,
          selectedQuality: _selectedQuality,
          playbackSpeed: _playbackSpeed,
          title: widget.title ?? _aparatInfo?.title ?? 'ویدیو',
          onQualityChanged: (q, u) => _changeQuality(q, u),
          onSpeedChanged: (s) => _changeSpeed(s),
        ),
      ),
    ).then((_) {
      if (mounted) {
        SystemChrome.setPreferredOrientations([DeviceOrientation.portraitUp]);
        setState(() {});
      }
    });
  }

  @override
  Widget build(BuildContext context) {
    return Container(
      decoration: BoxDecoration(
        borderRadius: BorderRadius.circular(20),
        gradient: const LinearGradient(
          begin: Alignment.centerLeft,
          end: Alignment.centerRight,
          stops: [0.0, 0.5, 1.0],
          colors: [
            Color(0xFF3A3A6A),
            Color(0xFF9292E2),
            Color(0xFF3A3A6A),
          ],
        ),
      ),
      padding: const EdgeInsets.all(1.2), // Gradient border
      child: ClipRRect(
        borderRadius: BorderRadius.circular(18.8),
        child: Container(
          color: const Color(0xFF1E1D34),
          child: AspectRatio(
            aspectRatio: 16 / 9,
            child: Stack(
              fit: StackFit.expand,
              children: [
                // 1. Video Player or Thumbnail Poster
                if (_isInitialized && _controller != null)
                  GestureDetector(
                    onTap: _toggleControls,
                    child: Center(
                      child: AspectRatio(
                        aspectRatio: _controller!.value.aspectRatio > 0
                            ? _controller!.value.aspectRatio
                            : 16 / 9,
                        child: VideoPlayer(_controller!),
                      ),
                    ),
                  )
                else
                  _buildThumbnailPoster(),

                // 2. Loading Spinner
                if (_isLoading)
                  Container(
                    color: Colors.black45,
                    child: const Center(
                      child: CircularProgressIndicator(
                        strokeWidth: 2.5,
                        color: Color(0xFFC09268),
                      ),
                    ),
                  ),

                // 3. Error Fallback
                if (_hasError)
                  Container(
                    color: const Color(0xFF28274A),
                    padding: const EdgeInsets.all(16),
                    child: Column(
                      mainAxisAlignment: MainAxisAlignment.center,
                      children: [
                        const Icon(Icons.error_outline_rounded, color: Color(0xFFEF4444), size: 36),
                        const SizedBox(height: 8),
                        const Text(
                          'خطا در بارگذاری ویدیو',
                          style: TextStyle(
                            color: Colors.white,
                            fontSize: 13,
                            fontWeight: FontWeight.bold,
                            fontFamily: AppTheme.fontFamily,
                          ),
                        ),
                        const SizedBox(height: 10),
                        ElevatedButton.icon(
                          onPressed: () => _startVideo(),
                          icon: const Icon(Icons.refresh_rounded, size: 16, color: Colors.white),
                          label: const Text('تلاش مجدد', style: TextStyle(color: Colors.white, fontSize: 11, fontFamily: AppTheme.fontFamily)),
                          style: ElevatedButton.styleFrom(
                            backgroundColor: const Color(0xFFC09268),
                            padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 6),
                          ),
                        ),
                      ],
                    ),
                  ),

                // 4. Play Button Overlay before video initialization
                if (!_isInitialized && !_isLoading && !_hasError)
                  Center(
                    child: Material(
                      color: Colors.transparent,
                      child: InkWell(
                        onTap: () => _startVideo(),
                        borderRadius: BorderRadius.circular(30),
                        child: Container(
                          width: 58,
                          height: 58,
                          decoration: BoxDecoration(
                            shape: BoxShape.circle,
                            gradient: const LinearGradient(
                              colors: [Color(0xFFC09268), Color(0xFFF4DCC5)],
                              begin: Alignment.bottomRight,
                              end: Alignment.topLeft,
                            ),
                            boxShadow: [
                              BoxShadow(
                                color: const Color(0xFFC09268).withValues(alpha: 0.5),
                                blurRadius: 16,
                                offset: const Offset(0, 4),
                              ),
                            ],
                          ),
                          child: const Center(
                            child: Icon(
                              Icons.play_arrow_rounded,
                              color: Color(0xFF1E1D34),
                              size: 38,
                            ),
                          ),
                        ),
                      ),
                    ),
                  ),

                // 5. Video Overlay Controls
                if (_isInitialized && _showControls && !_isLoading)
                  _buildControlsOverlay(),
              ],
            ),
          ),
        ),
      ),
    );
  }

  Widget _buildThumbnailPoster() {
    final poster = widget.coverImageUrl ?? _aparatInfo?.posterUrl;
    if (poster != null && poster.isNotEmpty && poster.startsWith('http')) {
      return CachedNetworkImage(
        imageUrl: poster,
        fit: BoxFit.cover,
        placeholder: (context, url) => _buildDefaultThumbnail(),
        errorWidget: (context, url, error) => _buildDefaultThumbnail(),
      );
    }
    return _buildDefaultThumbnail();
  }

  Widget _buildDefaultThumbnail() {
    return Container(
      decoration: const BoxDecoration(
        gradient: LinearGradient(
          begin: Alignment.topCenter,
          end: Alignment.bottomCenter,
          stops: [0.0, 0.53, 1.0],
          colors: [
            Color(0xFF3D3C67),
            Color(0xFF36345C),
            Color(0xFF333359),
          ],
        ),
      ),
      child: Center(
        child: SvgPicture.asset(
          'assets/svg_icons/vedionot01.svg',
          width: 48,
          height: 48,
          fit: BoxFit.contain,
        ),
      ),
    );
  }

  Widget _buildControlsOverlay() {
    final controller = _controller!;
    final pos = controller.value.position;
    final dur = controller.value.duration;
    final isEnded = dur > Duration.zero && pos >= dur;

    return Container(
      decoration: BoxDecoration(
        gradient: LinearGradient(
          begin: Alignment.topCenter,
          end: Alignment.bottomCenter,
          colors: [
            Colors.black.withValues(alpha: 0.6),
            Colors.transparent,
            Colors.black.withValues(alpha: 0.8),
          ],
          stops: const [0.0, 0.45, 1.0],
        ),
      ),
      child: Column(
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        children: [
          // Top Row: Quality Switcher, Speed Selector, and Title
          Padding(
            padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
            child: Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                // Right in RTL: Title
                Expanded(
                  child: Text(
                    widget.title ?? _aparatInfo?.title ?? '',
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    style: const TextStyle(
                      color: Colors.white,
                      fontSize: 11,
                      fontWeight: FontWeight.bold,
                      fontFamily: AppTheme.fontFamily,
                    ),
                  ),
                ),

                // Left buttons: Speed & Quality
                Row(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    // Speed Selector Menu
                    PopupMenuButton<double>(
                      initialValue: _playbackSpeed,
                      tooltip: 'سرعت پخش',
                      padding: EdgeInsets.zero,
                      constraints: const BoxConstraints(),
                      onSelected: _changeSpeed,
                      itemBuilder: (context) => [
                        const PopupMenuItem(value: 0.5, child: Text('0.5x')),
                        const PopupMenuItem(value: 0.75, child: Text('0.75x')),
                        const PopupMenuItem(value: 1.0, child: Text('1.0x (عادی)')),
                        const PopupMenuItem(value: 1.25, child: Text('1.25x')),
                        const PopupMenuItem(value: 1.5, child: Text('1.5x')),
                        const PopupMenuItem(value: 2.0, child: Text('2.0x')),
                      ],
                      child: Container(
                        padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                        decoration: BoxDecoration(
                          color: Colors.black54,
                          borderRadius: BorderRadius.circular(6),
                          border: Border.all(color: Colors.white24, width: 0.8),
                        ),
                        child: Text(
                          '${_playbackSpeed}x',
                          style: const TextStyle(color: Colors.white, fontSize: 10, fontWeight: FontWeight.bold),
                        ),
                      ),
                    ),
                    const SizedBox(width: 6),

                    // Quality Switcher Menu
                    if (_aparatInfo != null && _aparatInfo!.qualities.isNotEmpty)
                      PopupMenuButton<String>(
                        initialValue: _selectedQuality,
                        tooltip: 'کیفیت ویدیو',
                        padding: EdgeInsets.zero,
                        constraints: const BoxConstraints(),
                        child: Container(
                          padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                          decoration: BoxDecoration(
                            color: Colors.black54,
                            borderRadius: BorderRadius.circular(6),
                            border: Border.all(color: const Color(0xFFC09268), width: 0.8),
                          ),
                          child: Text(
                            _selectedQuality ?? 'کیفیت',
                            style: const TextStyle(color: Color(0xFFF4DCC5), fontSize: 10, fontWeight: FontWeight.bold),
                          ),
                        ),
                        onSelected: (quality) {
                          if (_aparatInfo!.qualities.containsKey(quality)) {
                            _changeQuality(quality, _aparatInfo!.qualities[quality]!);
                          }
                        },
                        itemBuilder: (context) => _aparatInfo!.qualities.entries.map((e) {
                          return PopupMenuItem(
                            value: e.key,
                            child: Text(
                              e.key,
                              style: TextStyle(
                                color: e.key == _selectedQuality ? const Color(0xFFC09268) : Colors.black87,
                                fontWeight: e.key == _selectedQuality ? FontWeight.bold : FontWeight.normal,
                              ),
                            ),
                          );
                        }).toList(),
                      ),
                  ],
                ),
              ],
            ),
          ),

          // Center Controls: Rewind 10s, Play/Pause/Replay, Forward 10s
          Row(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              // Rewind 10s
              IconButton(
                icon: const Icon(Icons.replay_10_rounded, color: Colors.white, size: 26),
                onPressed: () => _skipSeconds(-10),
              ),
              const SizedBox(width: 8),

              // Play / Pause / Replay Button
              Material(
                color: Colors.transparent,
                child: InkWell(
                  onTap: () {
                    if (isEnded) {
                      controller.seekTo(Duration.zero);
                      controller.play();
                    } else if (controller.value.isPlaying) {
                      controller.pause();
                    } else {
                      controller.play();
                    }
                    _resetControlsTimer();
                  },
                  borderRadius: BorderRadius.circular(24),
                  child: Container(
                    width: 46,
                    height: 46,
                    decoration: BoxDecoration(
                      shape: BoxShape.circle,
                      color: const Color(0xFFC09268).withValues(alpha: 0.9),
                    ),
                    child: Center(
                      child: Icon(
                        isEnded
                            ? Icons.replay_rounded
                            : (controller.value.isPlaying ? Icons.pause_rounded : Icons.play_arrow_rounded),
                        color: const Color(0xFF1E1D34),
                        size: 28,
                      ),
                    ),
                  ),
                ),
              ),
              const SizedBox(width: 8),

              // Forward 10s
              IconButton(
                icon: const Icon(Icons.forward_10_rounded, color: Colors.white, size: 26),
                onPressed: () => _skipSeconds(10),
              ),
            ],
          ),

          // Bottom Bar: Time, Progress Bar, Fullscreen Button
          Padding(
            padding: const EdgeInsets.only(left: 8, right: 8, bottom: 4),
            child: Row(
              children: [
                // Fullscreen Button
                IconButton(
                  icon: const Icon(Icons.fullscreen_rounded, color: Colors.white, size: 22),
                  padding: EdgeInsets.zero,
                  constraints: const BoxConstraints(),
                  onPressed: _openFullscreen,
                ),
                const SizedBox(width: 6),

                // Time Elapsed / Total
                Text(
                  '${_formatDuration(pos)} / ${_formatDuration(dur)}',
                  style: const TextStyle(color: Colors.white70, fontSize: 10, fontFamily: AppTheme.fontFamily),
                ),
                const SizedBox(width: 8),

                // Scrubbing Slider
                Expanded(
                  child: SliderTheme(
                    data: SliderTheme.of(context).copyWith(
                      thumbShape: const RoundSliderThumbShape(enabledThumbRadius: 5),
                      overlayShape: const RoundSliderOverlayShape(overlayRadius: 10),
                      trackHeight: 2.5,
                      activeTrackColor: const Color(0xFFC09268),
                      inactiveTrackColor: Colors.white24,
                      thumbColor: const Color(0xFFF4DCC5),
                    ),
                    child: Slider(
                      value: dur.inMilliseconds > 0
                          ? pos.inMilliseconds.clamp(0, dur.inMilliseconds).toDouble()
                          : 0.0,
                      max: dur.inMilliseconds > 0 ? dur.inMilliseconds.toDouble() : 1.0,
                      onChanged: (val) {
                        controller.seekTo(Duration(milliseconds: val.toInt()));
                        _resetControlsTimer();
                      },
                    ),
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

/// Fullscreen Immersive Video Page
class _FullscreenVideoPage extends StatefulWidget {
  final VideoPlayerController controller;
  final AparatVideoInfo? aparatInfo;
  final String? selectedQuality;
  final double playbackSpeed;
  final String title;
  final Function(String, String) onQualityChanged;
  final Function(double) onSpeedChanged;

  const _FullscreenVideoPage({
    required this.controller,
    this.aparatInfo,
    this.selectedQuality,
    required this.playbackSpeed,
    required this.title,
    required this.onQualityChanged,
    required this.onSpeedChanged,
  });

  @override
  State<_FullscreenVideoPage> createState() => _FullscreenVideoPageState();
}

class _FullscreenVideoPageState extends State<_FullscreenVideoPage> {
  bool _showControls = true;
  Timer? _timer;
  late double _speed;
  String? _quality;

  @override
  void initState() {
    super.initState();
    _speed = widget.playbackSpeed;
    _quality = widget.selectedQuality;
    SystemChrome.setPreferredOrientations([
      DeviceOrientation.landscapeLeft,
      DeviceOrientation.landscapeRight,
    ]);
    SystemChrome.setEnabledSystemUIMode(SystemUiMode.immersiveSticky);
    widget.controller.addListener(_onVideoTick);
    _resetTimer();
  }

  @override
  void dispose() {
    _timer?.cancel();
    widget.controller.removeListener(_onVideoTick);
    SystemChrome.setEnabledSystemUIMode(SystemUiMode.edgeToEdge);
    SystemChrome.setPreferredOrientations([
      DeviceOrientation.portraitUp,
    ]);
    super.dispose();
  }

  void _onVideoTick() {
    if (mounted) setState(() {});
  }

  void _resetTimer() {
    _timer?.cancel();
    if (_showControls && widget.controller.value.isPlaying) {
      _timer = Timer(const Duration(seconds: 4), () {
        if (mounted && widget.controller.value.isPlaying) {
          setState(() => _showControls = false);
        }
      });
    }
  }

  String _formatDuration(Duration duration) {
    final minutes = duration.inMinutes.remainder(60).toString().padLeft(2, '0');
    final seconds = duration.inSeconds.remainder(60).toString().padLeft(2, '0');
    if (duration.inHours > 0) {
      final hours = duration.inHours.toString().padLeft(2, '0');
      return '$hours:$minutes:$seconds';
    }
    return '$minutes:$seconds';
  }

  @override
  Widget build(BuildContext context) {
    final pos = widget.controller.value.position;
    final dur = widget.controller.value.duration;
    final isEnded = dur > Duration.zero && pos >= dur;

    return Scaffold(
      backgroundColor: Colors.black,
      body: GestureDetector(
        onTap: () {
          setState(() => _showControls = !_showControls);
          if (_showControls) _resetTimer();
        },
        child: Stack(
          fit: StackFit.expand,
          children: [
            Center(
              child: AspectRatio(
                aspectRatio: widget.controller.value.aspectRatio > 0
                    ? widget.controller.value.aspectRatio
                    : 16 / 9,
                child: VideoPlayer(widget.controller),
              ),
            ),

            if (_showControls)
              Container(
                decoration: BoxDecoration(
                  gradient: LinearGradient(
                    begin: Alignment.topCenter,
                    end: Alignment.bottomCenter,
                    colors: [
                      Colors.black87,
                      Colors.transparent,
                      Colors.black87,
                    ],
                    stops: const [0.0, 0.5, 1.0],
                  ),
                ),
                child: SafeArea(
                  child: Column(
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    children: [
                      // Top Bar
                      Padding(
                        padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
                        child: Row(
                          mainAxisAlignment: MainAxisAlignment.spaceBetween,
                          children: [
                            IconButton(
                              icon: const Icon(Icons.arrow_back_rounded, color: Colors.white),
                              onPressed: () => Navigator.pop(context),
                            ),
                            Expanded(
                              child: Text(
                                widget.title,
                                textAlign: TextAlign.center,
                                maxLines: 1,
                                overflow: TextOverflow.ellipsis,
                                style: const TextStyle(
                                  color: Colors.white,
                                  fontSize: 14,
                                  fontWeight: FontWeight.bold,
                                  fontFamily: AppTheme.fontFamily,
                                ),
                              ),
                            ),
                            Row(
                              children: [
                                // Speed
                                PopupMenuButton<double>(
                                  initialValue: _speed,
                                  child: Container(
                                    padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                                    decoration: BoxDecoration(
                                      color: Colors.white24,
                                      borderRadius: BorderRadius.circular(6),
                                    ),
                                    child: Text('${_speed}x', style: const TextStyle(color: Colors.white, fontSize: 12)),
                                  ),
                                  onSelected: (s) {
                                    setState(() => _speed = s);
                                    widget.onSpeedChanged(s);
                                  },
                                  itemBuilder: (_) => [
                                    const PopupMenuItem(value: 0.5, child: Text('0.5x')),
                                    const PopupMenuItem(value: 0.75, child: Text('0.75x')),
                                    const PopupMenuItem(value: 1.0, child: Text('1.0x')),
                                    const PopupMenuItem(value: 1.25, child: Text('1.25x')),
                                    const PopupMenuItem(value: 1.5, child: Text('1.5x')),
                                    const PopupMenuItem(value: 2.0, child: Text('2.0x')),
                                  ],
                                ),
                                const SizedBox(width: 8),

                                // Quality
                                if (widget.aparatInfo != null)
                                  PopupMenuButton<String>(
                                    initialValue: _quality,
                                    child: Container(
                                      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                                      decoration: BoxDecoration(
                                        color: const Color(0xFFC09268),
                                        borderRadius: BorderRadius.circular(6),
                                      ),
                                      child: Text(_quality ?? 'کیفیت', style: const TextStyle(color: Color(0xFF1E1D34), fontSize: 12, fontWeight: FontWeight.bold)),
                                    ),
                                    onSelected: (q) {
                                      setState(() => _quality = q);
                                      if (widget.aparatInfo!.qualities.containsKey(q)) {
                                        widget.onQualityChanged(q, widget.aparatInfo!.qualities[q]!);
                                      }
                                    },
                                    itemBuilder: (_) => widget.aparatInfo!.qualities.entries.map((e) {
                                      return PopupMenuItem(value: e.key, child: Text(e.key));
                                    }).toList(),
                                  ),
                              ],
                            ),
                          ],
                        ),
                      ),

                      // Center Play / Pause
                      Row(
                        mainAxisAlignment: MainAxisAlignment.center,
                        children: [
                          IconButton(
                            icon: const Icon(Icons.replay_10_rounded, color: Colors.white, size: 36),
                            onPressed: () {
                              final p = widget.controller.value.position - const Duration(seconds: 10);
                              widget.controller.seekTo(p < Duration.zero ? Duration.zero : p);
                              _resetTimer();
                            },
                          ),
                          const SizedBox(width: 24),
                          IconButton(
                            iconSize: 52,
                            icon: Icon(
                              isEnded
                                  ? Icons.replay_rounded
                                  : (widget.controller.value.isPlaying ? Icons.pause_circle_filled_rounded : Icons.play_circle_filled_rounded),
                              color: const Color(0xFFC09268),
                            ),
                            onPressed: () {
                              if (isEnded) {
                                widget.controller.seekTo(Duration.zero);
                                widget.controller.play();
                              } else if (widget.controller.value.isPlaying) {
                                widget.controller.pause();
                              } else {
                                widget.controller.play();
                              }
                              _resetTimer();
                            },
                          ),
                          const SizedBox(width: 24),
                          IconButton(
                            icon: const Icon(Icons.forward_10_rounded, color: Colors.white, size: 36),
                            onPressed: () {
                              final p = widget.controller.value.position + const Duration(seconds: 10);
                              final d = widget.controller.value.duration;
                              widget.controller.seekTo(p > d ? d : p);
                              _resetTimer();
                            },
                          ),
                        ],
                      ),

                      // Bottom Progress Slider
                      Padding(
                        padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 12),
                        child: Row(
                          children: [
                            IconButton(
                              icon: const Icon(Icons.fullscreen_exit_rounded, color: Colors.white, size: 28),
                              onPressed: () => Navigator.pop(context),
                            ),
                            const SizedBox(width: 8),
                            Text(
                              '${_formatDuration(pos)} / ${_formatDuration(dur)}',
                              style: const TextStyle(color: Colors.white, fontSize: 13, fontFamily: AppTheme.fontFamily),
                            ),
                            const SizedBox(width: 14),
                            Expanded(
                              child: SliderTheme(
                                data: SliderTheme.of(context).copyWith(
                                  thumbShape: const RoundSliderThumbShape(enabledThumbRadius: 6),
                                  overlayShape: const RoundSliderOverlayShape(overlayRadius: 12),
                                  trackHeight: 3.5,
                                  activeTrackColor: const Color(0xFFC09268),
                                  inactiveTrackColor: Colors.white24,
                                  thumbColor: const Color(0xFFF4DCC5),
                                ),
                                child: Slider(
                                  value: dur.inMilliseconds > 0
                                      ? pos.inMilliseconds.clamp(0, dur.inMilliseconds).toDouble()
                                      : 0.0,
                                  max: dur.inMilliseconds > 0 ? dur.inMilliseconds.toDouble() : 1.0,
                                  onChanged: (val) {
                                    widget.controller.seekTo(Duration(milliseconds: val.toInt()));
                                    _resetTimer();
                                  },
                                ),
                              ),
                            ),
                          ],
                        ),
                      ),
                    ],
                  ),
                ),
              ),
          ],
        ),
      ),
    );
  }
}
