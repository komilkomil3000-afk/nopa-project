import 'dart:async';
import 'dart:math' as math;

import 'api_service.dart';
import 'app_state_repository.dart';

/// Which station video a player shows, for the watch tracking (POST /usage/video on the server).
class VideoWatchInfo {
  /// "session" (a part of a class session) or "gallery" (a video of the station's نگارستان).
  final String kind;
  final String clipId;
  final String stationId;
  final String sessionId;
  final String trackType;
  final String title;

  const VideoWatchInfo({
    required this.kind,
    required this.clipId,
    this.stationId = '',
    this.sessionId = '',
    this.trackType = '',
    this.title = '',
  });

  bool get isValid => clipId.isNotEmpty && (kind == 'session' || kind == 'gallery');
}

/// Follows one player and reports how the video is really watched:
///  * the ranges of the video that were really played: a seek (dragging the bar, ±10 s) starts a new range and the
///    skipped part is not counted, and playing the same part again adds nothing. [fraction] is the share of the
///    video covered so far (also what was watched before, on any device) — the part quiz opens at 90 %.
///  * the time it played, repeats included (the panel's «زمان تماشای فیلم‌ها»).
/// Reports go out every ~15 s of playing, on pause and when the player closes (that last one also adds one row,
/// "watched … for N minutes", to the person's activity log in the panel).
class VideoWatchTracker {
  VideoWatchTracker(this.info, {this.onFraction}) {
    final cached = _cache[_cacheKey];
    if (cached != null) _segs.addAll(cached.map((s) => [s[0], s[1]]));
    _loadFromServer();
  }

  final VideoWatchInfo info;

  /// Called when the watched share of the video changes (0..1).
  final void Function(double fraction)? onFraction;

  // Ranges watched in this app run (per clip), so reopening a clip keeps them even when a report failed.
  static final Map<String, List<List<int>>> _cache = {};
  String get _cacheKey => '${AppRepository().currentUser.id}|${info.clipId}';

  static const int _reportEveryMs = 15000;

  final List<List<int>> _segs = []; // merged [startMs, endMs]
  int _durationMs = 0;
  int? _lastPosMs;
  DateTime? _lastWall;
  int _pendingPlayMs = 0; // played since the last successful report
  int _viewMs = 0; // played since this player opened (the log row)
  int _pendingStarts = 0;
  bool _wasPlaying = false;
  bool _atEnd = true; // the next play is a new viewing
  bool _sending = false;
  bool _closed = false;
  double _lastFraction = -1;

  double get fraction {
    if (_durationMs <= 0) return 0;
    final covered = _segs.fold<int>(0, (s, r) => s + (r[1] - r[0]));
    return math.min(1.0, covered / _durationMs);
  }

  /// Fed by the player on every controller update.
  void tick({required Duration position, required Duration duration, required bool playing, double speed = 1.0}) {
    if (_closed) return;
    final now = DateTime.now();
    final pos = position.inMilliseconds;
    if (duration.inMilliseconds > 0) _durationMs = duration.inMilliseconds;

    if (!playing) {
      if (_wasPlaying) {
        _wasPlaying = false;
        _flush(); // paused / ended: send what was gathered
      }
      _lastPosMs = null;
      _lastWall = null;
      if (_durationMs > 0 && pos >= _durationMs - 600) _atEnd = true;
      return;
    }

    if (!_wasPlaying) {
      _wasPlaying = true;
      if (_atEnd) {
        _pendingStarts++;
        _atEnd = false;
      }
    }
    final lastPos = _lastPosMs;
    final lastWall = _lastWall;
    if (lastPos != null && lastWall != null) {
      final dPos = pos - lastPos;
      final dWall = now.difference(lastWall).inMilliseconds;
      // moved forward about as much as the time that passed (at the chosen speed): really played, not a seek
      final allowed = dWall * math.max(1.0, speed) * 1.5 + 1200;
      if (dPos > 0 && dPos <= allowed) {
        _addRange(lastPos, pos);
        final played = math.min(dWall, 5000);
        _pendingPlayMs += played;
        _viewMs += played;
      }
    }
    _lastPosMs = pos;
    _lastWall = now;
    if (_durationMs > 0 && pos >= _durationMs - 600) _atEnd = true;
    _notifyFraction();
    if (_pendingPlayMs >= _reportEveryMs) _flush();
  }

  void _addRange(int start, int end) {
    _segs.add([start, end]);
    _merge();
    _cache[_cacheKey] = _segs.map((s) => [s[0], s[1]]).toList();
  }

  void _merge() {
    _segs.sort((a, b) => a[0].compareTo(b[0]));
    final out = <List<int>>[];
    for (final s in _segs) {
      if (out.isNotEmpty && s[0] <= out.last[1] + 1000) {
        out.last[1] = math.max(out.last[1], s[1]);
      } else {
        out.add([s[0], s[1]]);
      }
    }
    _segs
      ..clear()
      ..addAll(out);
  }

  void _notifyFraction() {
    final f = fraction;
    // tell the screen about whole-percent changes only
    if ((f * 100).floor() == (_lastFraction * 100).floor()) return;
    _lastFraction = f;
    onFraction?.call(f);
  }

  /// Ranges from the server (seconds) are merged with the ones played here.
  void _mergeServer(Map<String, dynamic>? data) {
    if (data == null) return;
    final segs = data['segments'];
    if (segs is List) {
      for (final r in segs) {
        if (r is List && r.length >= 2) {
          final s = ((r[0] as num?) ?? 0).toInt() * 1000;
          final e = ((r[1] as num?) ?? 0).toInt() * 1000;
          if (e > s) _segs.add([s, e]);
        }
      }
      _merge();
      _cache[_cacheKey] = _segs.map((s) => [s[0], s[1]]).toList();
    }
    final d = ((data['durationSeconds'] as num?) ?? 0).toInt();
    if (_durationMs <= 0 && d > 0) _durationMs = d * 1000;
    _notifyFraction();
  }

  Future<void> _loadFromServer() async {
    if (!info.isValid) return;
    _mergeServer(await HttpApiService().getVideoWatch(info.clipId));
  }

  Future<void> _flush({bool last = false}) async {
    if (!info.isValid || _sending) return;
    if (_pendingPlayMs < 1000 && _pendingStarts == 0 && !last) return;
    _sending = true;
    final play = _pendingPlayMs;
    final starts = _pendingStarts;
    final body = <String, dynamic>{
      'clipId': info.clipId,
      'kind': info.kind,
      'stationId': info.stationId,
      'sessionId': info.sessionId,
      'trackType': info.trackType,
      'title': info.title,
      'duration': (_durationMs / 1000).round(),
      'playSeconds': (play / 1000).round(),
      'segments': _segs.map((s) => [s[0] ~/ 1000, (s[1] / 1000).ceil()]).toList(),
      if (starts > 0) 'started': true,
      if (last) 'final': true,
      if (last) 'viewSeconds': (_viewMs / 1000).round(),
    };
    try {
      final res = await HttpApiService().reportVideoWatch(body);
      if (res != null) {
        _pendingPlayMs = math.max(0, _pendingPlayMs - play);
        _pendingStarts = math.max(0, _pendingStarts - starts);
        if (!_closed) _mergeServer(res);
      }
    } finally {
      _sending = false;
    }
  }

  /// The player closed: the last report (with the log row of this viewing).
  void close() {
    if (_closed) return;
    _closed = true;
    if (_viewMs < 1000 && _pendingStarts == 0) return;
    // wait for a report still on its way, then send the last one
    Future<void> send() async {
      for (var i = 0; i < 20 && _sending; i++) {
        await Future.delayed(const Duration(milliseconds: 250));
      }
      _sending = false;
      await _flush(last: true);
    }

    unawaited(send());
  }
}
