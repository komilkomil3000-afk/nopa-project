import 'dart:convert';
import 'dart:io' show InternetAddressType, NetworkInterface;
import 'dart:io' as io show File;
import 'package:http/http.dart' as http;
import '../models/models.dart';
import 'package:flutter/foundation.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';

class HttpApiService {
  static const String _cachedHostKey = 'cached_backend_host';
  static const String _defaultHost = '192.168.100.51';
  static final String _envHost = const String.fromEnvironment('NOPA_BACKEND_HOST');

  static final HttpApiService _instance = HttpApiService._internal();
  factory HttpApiService() => _instance;
  HttpApiService._internal();

  static const _secureStorage = FlutterSecureStorage();
  static VoidCallback? onUnauthorized;

  String _activeHost = _defaultHost;
  String get activeHost => _activeHost;
  late String _activeBaseUrl = 'http://$_defaultHost:5000/api/v1';
  String get baseUrl => _activeBaseUrl;

  String? _token;
  String? get token => _token;
  bool get isAuthenticated => _token != null;

  bool _isHandling401 = false;

  /// Offload JSON decoding to a background isolate when payload exceeds 10KB
  static Future<dynamic> parseJsonAsync(String source) async {
    if (source.isEmpty) return null;
    if (source.length > 10240) {
      return compute(_isolateJsonDecode, source);
    }
    return jsonDecode(source);
  }

  static dynamic _isolateJsonDecode(String source) {
    return jsonDecode(source);
  }

  /// Automatic token invalidation on 401 Unauthorized
  void handleUnauthorized() {
    if (_isHandling401) return;
    _isHandling401 = true;
    debugPrint('🚨 [HttpApiService] 401 Unauthorized received! Clearing token and routing to /auth...');

    _token = null;
    _secureStorage.delete(key: 'auth_token').catchError((e) {
      debugPrint('Failed to delete auth_token: $e');
    });

    Future.microtask(() {
      onUnauthorized?.call();
    });

    Future.delayed(const Duration(seconds: 2), () {
      _isHandling401 = false;
    });
  }

  /// Internal HTTP wrappers that monitor status codes for 401 Unauthorized
  Future<http.Response> _get(Uri url, {Map<String, String>? headers, bool checkAuth = true}) async {
    final response = await http.get(url, headers: headers ?? _getHeaders());
    if (checkAuth && response.statusCode == 401) {
      handleUnauthorized();
    }
    return response;
  }

  Future<http.Response> _post(Uri url, {Map<String, String>? headers, Object? body, bool checkAuth = true}) async {
    final response = await http.post(url, headers: headers ?? _getHeaders(), body: body);
    if (checkAuth && response.statusCode == 401) {
      handleUnauthorized();
    }
    return response;
  }

  Future<http.Response> _patch(Uri url, {Map<String, String>? headers, Object? body, bool checkAuth = true}) async {
    final response = await http.patch(url, headers: headers ?? _getHeaders(), body: body);
    if (checkAuth && response.statusCode == 401) {
      handleUnauthorized();
    }
    return response;
  }

  Future<http.Response> _delete(Uri url, {Map<String, String>? headers, Object? body, bool checkAuth = true}) async {
    final response = await http.delete(url, headers: headers ?? _getHeaders(), body: body);
    if (checkAuth && response.statusCode == 401) {
      handleUnauthorized();
    }
    return response;
  }

  Future<http.Response> authenticatedDelete(String path) async {
    return await _delete(Uri.parse('$baseUrl$path'));
  }

  Future<List<String>> _buildHostCandidates() async {
    final candidates = <String>[];
    if (_envHost.isNotEmpty) {
      candidates.add(_envHost);
    }
    candidates.add(_defaultHost);
    candidates.add('10.0.2.2'); // Android Emulator
    candidates.add('localhost');
    candidates.add('127.0.0.1');

    try {
      final interfaces = await NetworkInterface.list(includeLoopback: false, type: InternetAddressType.IPv4);
      for (final interface in interfaces) {
        for (final addr in interface.addresses) {
          if (!addr.isLoopback && addr.type == InternetAddressType.IPv4) {
            final host = addr.address;
            if (!candidates.contains(host)) {
              candidates.add(host);
            }
          }
        }
      }
    } catch (e) {
      debugPrint('NetworkInterface list failed: $e');
    }

    return candidates;
  }

  Future<bool> _pingHost(String host, {int timeoutMs = 500}) async {
    try {
      final res = await http.get(Uri.parse('http://$host:5000/health')).timeout(Duration(milliseconds: timeoutMs));
      return res.statusCode == 200;
    } catch (_) {
      return false;
    }
  }

  /// Fast-path backend health check that uses cached IP to eliminate startup UI freezes
  Future<void> checkBackendHealth() async {
    try {
      _token = await _secureStorage.read(key: 'auth_token');
      debugPrint('🔑 Loaded cached token: ${_token != null ? "exists" : "null"}');
    } catch (e) {
      debugPrint('Failed to read token from secure storage: $e');
    }

    String? cachedHost;
    try {
      cachedHost = await _secureStorage.read(key: _cachedHostKey);
    } catch (e) {
      debugPrint('Failed to read cached_backend_host: $e');
    }

    final targetHost = cachedHost ?? (_envHost.isNotEmpty ? _envHost : _defaultHost);
    _activeHost = targetHost;
    _activeBaseUrl = 'http://$targetHost:5000/api/v1';

    // 1. Fast ping target host (<= 500ms)
    final isHealthy = await _pingHost(targetHost, timeoutMs: 500);
    if (isHealthy) {
      debugPrint('⚡ Fast-path verified: Connected to backend on http://$targetHost:5000 (0ms probe delay)');
      if (cachedHost != targetHost) {
        await _secureStorage.write(key: _cachedHostKey, value: targetHost);
      }
      return;
    }

    debugPrint('⚠️ Preferred host $targetHost:5000 unresponsive; running concurrent candidate discovery...');
    // 2. Concurrently probe candidates if cached host is unreachable
    await _probeCandidatesConcurrently();
  }

  Future<void> _probeCandidatesConcurrently() async {
    final candidates = await _buildHostCandidates();
    debugPrint('🔗 Concurrent candidate probing: $candidates');

    final probeFutures = candidates.map((host) async {
      final ok = await _pingHost(host, timeoutMs: 700);
      if (ok) return host;
      return null;
    }).toList();

    final results = await Future.wait(probeFutures);
    final workingHost = results.firstWhere((h) => h != null, orElse: () => null);

    if (workingHost != null) {
      _activeHost = workingHost;
      _activeBaseUrl = 'http://$workingHost:5000/api/v1';
      await _secureStorage.write(key: _cachedHostKey, value: workingHost);
      debugPrint('🔗 Resolved & cached working backend: http://$workingHost:5000');
    } else {
      _activeBaseUrl = 'http://$_defaultHost:5000/api/v1';
      debugPrint('🔗 Fallback to default backend: $_activeBaseUrl');
    }
  }

  Future<void> setToken(String? token) async {
    _token = token;
    if (token != null) {
      await _secureStorage.write(key: 'auth_token', value: token);
    } else {
      await _secureStorage.delete(key: 'auth_token');
    }
  }

  Map<String, String> _getHeaders() {
    return {
      'Content-Type': 'application/json',
      if (_token != null) 'Authorization': 'Bearer $_token',
    };
  }

  // Auth & Login
  Future<Map<String, dynamic>?> verifyPhone(String phoneNumber) async {
    try {
      final response = await _post(
        Uri.parse('$baseUrl/auth/verify-phone'),
        headers: {'Content-Type': 'application/json'},
        body: jsonEncode({'phoneNumber': phoneNumber}),
        checkAuth: false,
      );
      if (response.statusCode == 200) {
        return (await parseJsonAsync(response.body)) as Map<String, dynamic>?;
      }
      return null;
    } catch (e) {
      debugPrint('Verify phone error: $e');
      return null;
    }
  }

  Future<dynamic> login(String phoneNumber, {String? password, String? role}) async {
    try {
      final bodyMap = <String, dynamic>{'phoneNumber': phoneNumber};
      if (password != null) bodyMap['password'] = password;
      if (role != null) bodyMap['role'] = role;
      
      final response = await _post(
        Uri.parse('$baseUrl/auth/login'),
        headers: {'Content-Type': 'application/json'},
        body: jsonEncode(bodyMap),
        checkAuth: false,
      );

      final data = await parseJsonAsync(response.body);

      if (response.statusCode == 300) {
        return {'status': 'multiple_profiles', 'profiles': data['profiles']};
      }

      if (response.statusCode == 200) {
        _token = data['token'];
        await _secureStorage.write(key: 'auth_token', value: _token);
        return {'status': 'success', 'data': data};
      }
      
      return {'status': 'error', 'message': data['message'] ?? data['error'] ?? 'خطایی رخ داده است'};
    } catch (e) {
      debugPrint('Login error: $e');
      return {'status': 'error', 'message': 'خطای ارتباط با سرور'};
    }
  }

  Future<dynamic> register({
    required String fullName,
    required String phoneNumber,
    required String countryCode,
    required String city,
    required String dateOfBirth,
    required String password,
  }) async {
    try {
      final response = await _post(
        Uri.parse('$baseUrl/auth/register'),
        headers: {'Content-Type': 'application/json'},
        body: jsonEncode({
          'fullName': fullName,
          'phoneNumber': phoneNumber,
          'countryCode': countryCode,
          'city': city,
          'dateOfBirth': dateOfBirth,
          'password': password,
        }),
        checkAuth: false,
      );

      final data = await parseJsonAsync(response.body);

      if (response.statusCode == 200) {
        _token = data['token'];
        await _secureStorage.write(key: 'auth_token', value: _token);
        return {'status': 'success', 'data': data};
      }
      
      return {'status': 'error', 'message': data['message'] ?? data['error'] ?? 'خطایی در ثبت‌نام رخ داده است'};
    } catch (e) {
      debugPrint('Register error: $e');
      return {'status': 'error', 'message': 'خطای ارتباط با سرور'};
    }
  }

  Future<bool> logout() async {
    try {
      final response = await _post(
        Uri.parse('$baseUrl/auth/logout'),
        headers: _getHeaders(),
      );
      _token = null;
      await _secureStorage.delete(key: 'auth_token');
      return response.statusCode == 200;
    } catch (e) {
      debugPrint('Logout error: $e');
      _token = null;
      await _secureStorage.delete(key: 'auth_token');
      return false;
    }
  }

  Future<bool> changePassword(String? currentPassword, String newPassword) async {
    try {
      final response = await _post(
        Uri.parse('$baseUrl/auth/change-password'),
        headers: _getHeaders(),
        body: jsonEncode({
          if (currentPassword != null && currentPassword.isNotEmpty)
            'currentPassword': currentPassword,
          'newPassword': newPassword,
        }),
      );

      if (response.statusCode == 200) {
        return true;
      }
      final data = await parseJsonAsync(response.body);
      debugPrint('Change password failed: ${data?['error'] ?? response.body}');
      return false;
    } catch (e) {
      debugPrint('Change password error: $e');
      return false;
    }
  }

  Future<void> completeProfile(Map<String, dynamic> payload) async {
    try {
      await _post(
        Uri.parse('$baseUrl/users/complete-profile'),
        headers: _getHeaders(),
        body: jsonEncode(payload),
      );
    } catch (e) {
      debugPrint('completeProfile error: $e');
    }
  }

  Future<http.Response> authenticatedPost(String path, Map<String, dynamic> body) async {
    return await _post(
      Uri.parse('$baseUrl$path'),
      headers: _getHeaders(),
      body: jsonEncode(body),
    );
  }

  // Get Me
  Future<UserModel?> getMe() async {
    try {
      final response = await _get(
        Uri.parse('$baseUrl/users/me'),
        headers: _getHeaders(),
      );

      if (response.statusCode == 200) {
        final data = await parseJsonAsync(response.body);
        if (data != null) {
          return UserModel.fromJson(data);
        }
      }
      return null;
    } catch (e) {
      debugPrint('HTTP getMe error: $e');
      return null;
    }
  }

  // Get Challenges
  Future<List<ChallengeModel>> getChallenges() async {
    try {
      final response = await _get(
        Uri.parse('$baseUrl/challenges'),
        headers: _getHeaders(),
      );

      if (response.statusCode == 200) {
        final dynamic data = await parseJsonAsync(response.body);
        if (data is List) {
          return data.map((json) => ChallengeModel(
            id: json['id'],
            title: json['title'],
            description: json['description'],
            rewardZarik: json['rewardZarik'],
            type: json['type'],
            questions: json['questions'] != null ? List<Map<String, dynamic>>.from(json['questions']) : null,
            createdByMentorId: json['createdByMentorId'],
            progress: 0.0,
          )).toList();
        }
      }
      return [];
    } catch (e) {
      debugPrint('HTTP getChallenges error: $e');
      return [];
    }
  }

  // Submit Quiz Challenge
  Future<Map<String, dynamic>?> submitQuizChallenge(String challengeId, List<int> answers) async {
    try {
      final response = await _post(
        Uri.parse('$baseUrl/challenges/$challengeId/submit-quiz'),
        headers: _getHeaders(),
        body: jsonEncode({
          'answers': answers,
        }),
      );
      if (response.statusCode == 200) {
        return (await parseJsonAsync(response.body)) as Map<String, dynamic>?;
      }
      return null;
    } catch (e) {
      debugPrint('HTTP submitQuizChallenge error: $e');
      return null;
    }
  }
  String resolveMediaUrl(String url) {
    if (url.startsWith('http://') || url.startsWith('https://')) {
      return url;
    }
    if (url.startsWith('/')) {
      return '${baseUrl.replaceAll('/api/v1', '')}$url';
    }
    return '${baseUrl.replaceAll('/api/v1', '')}/$url';
  }

  // Get Course Classes
  Future<List<Map<String, dynamic>>> getClasses() async {
    try {
      final response = await _get(
        Uri.parse('$baseUrl/classes'),
        headers: _getHeaders(),
      );

      if (response.statusCode == 200) {
        final dynamic data = await parseJsonAsync(response.body);
        if (data is List) {
          return List<Map<String, dynamic>>.from(data);
        }
      }
      return [];
    } catch (e) {
      debugPrint('HTTP getClasses error: $e');
      return [];
    }
  }

  // Get Stations
  Future<List<Map<String, dynamic>>> getStations() async {
    try {
      final response = await _get(
        Uri.parse('$baseUrl/lms/stations'),
        headers: _getHeaders(),
      );

      if (response.statusCode == 200) {
        final dynamic data = await parseJsonAsync(response.body);
        if (data is List) {
          return List<Map<String, dynamic>>.from(data);
        }
      }
      return [];
    } catch (e) {
      debugPrint('HTTP getStations error: $e');
      return [];
    }
  }

  Future<List<Map<String, dynamic>>> getMentorLeaderboard() async {
    try {
      final response = await _get(Uri.parse('$baseUrl/leagues/mentors'), headers: _getHeaders());
      if (response.statusCode == 200) {
        final dynamic data = await parseJsonAsync(response.body);
        if (data is List) {
          return List<Map<String, dynamic>>.from(data);
        }
      }
      return [];
    } catch (e) {
      debugPrint('getMentorLeaderboard error: $e');
      return [];
    }
  }

  Future<List<Map<String, dynamic>>> getNews() async {
    try {
      final response = await _get(Uri.parse('$baseUrl/news'), headers: _getHeaders());
      if (response.statusCode == 200) {
        final dynamic data = await parseJsonAsync(response.body);
        if (data is List) {
          return List<Map<String, dynamic>>.from(data);
        }
      }
      return [];
    } catch (e) {
      debugPrint('getNews error: $e');
      return [];
    }
  }

  Future<List<Map<String, dynamic>>> getBanners({String? position}) async {
    try {
      final url = position != null ? '$baseUrl/banners?position=$position' : '$baseUrl/banners';
      final response = await _get(Uri.parse(url), headers: _getHeaders());
      if (response.statusCode == 200) {
        final dynamic data = await parseJsonAsync(response.body);
        if (data is List) {
          return List<Map<String, dynamic>>.from(data);
        }
      }
      return [];
    } catch (e) {
      debugPrint('getBanners error: $e');
      return [];
    }
  }

  // Buy Zarik (Mock Payment Simulator)
  Future<bool> buyZarikPackage(int packageZarikAmount) async {
    await Future.delayed(const Duration(seconds: 2));
    debugPrint('MOCK: Successfully purchased $packageZarikAmount Zarik.');
    return true;
  }

  // Upload media file (multipart) to backend media upload endpoint
  Future<Map<String, dynamic>?> uploadMediaFile(io.File file, {String assetType = 'submission', String? title}) async {
    try {
      final uri = Uri.parse('${baseUrl.replaceAll('/api/v1', '')}/api/v1/media/upload');
      final request = http.MultipartRequest('POST', uri);
      if (_token != null) request.headers['Authorization'] = 'Bearer $_token';
      request.fields['assetType'] = assetType;
      if (title != null) request.fields['title'] = title;
      final multipartFile = await http.MultipartFile.fromPath('file', file.path);
      request.files.add(multipartFile);
      final streamed = await request.send();
      final resp = await http.Response.fromStream(streamed);
      if (resp.statusCode == 201 || resp.statusCode == 200) {
        final data = await parseJsonAsync(resp.body);
        return data as Map<String, dynamic>?;
      }
      debugPrint('uploadMediaFile failed: ${resp.statusCode} ${resp.body}');
      return null;
    } catch (e) {
      debugPrint('uploadMediaFile error: $e');
      return null;
    }
  }

  // Get pending submissions for mentors
  Future<List<Map<String, dynamic>>> getPendingSubmissions() async {
    try {
      final response = await _get(Uri.parse('$baseUrl/submissions/pending'), headers: _getHeaders());
      if (response.statusCode == 200) {
        final dynamic data = await parseJsonAsync(response.body);
        if (data is List) {
          return List<Map<String, dynamic>>.from(data);
        }
      }
      return [];
    } catch (e) {
      debugPrint('getPendingSubmissions error: $e');
      return [];
    }
  }

  // Review a submission as mentor
  Future<Map<String, dynamic>> reviewSubmission(String submissionId, {required String status, int? score, String? mentorFeedback}) async {
    try {
      final payload = <String, dynamic>{'status': status};
      if (score != null) payload['score'] = score;
      if (mentorFeedback != null) payload['mentorFeedback'] = mentorFeedback;

      final response = await _patch(
        Uri.parse('$baseUrl/submissions/$submissionId/review'),
        headers: _getHeaders(),
        body: jsonEncode(payload),
      );
      if (response.statusCode == 200) {
        return {'success': true};
      } else {
        final d = await parseJsonAsync(response.body);
        return {'success': false, 'error': d?['error'] ?? 'خطای ناشناخته'};
      }
    } catch (e) {
      debugPrint('reviewSubmission error: $e');
      return {'success': false, 'error': 'خطای ارتباط با سرور'};
    }
  }

  // Unlock Class
  Future<bool> unlockClass(String classId, int costZarik) async {
    await Future.delayed(const Duration(seconds: 1));
    debugPrint('MOCK: Unlocked class $classId for $costZarik Zarik.');
    return true;
  }

  // Get Media Assets
  Future<List<Map<String, dynamic>>> getMediaAssets({String? type}) async {
    try {
      final response = await _get(
        Uri.parse('$baseUrl/media'),
        headers: _getHeaders(),
      );

      if (response.statusCode == 200) {
        final dynamic data = await parseJsonAsync(response.body);
        if (data is List) {
          List<Map<String, dynamic>> media = List<Map<String, dynamic>>.from(data);
          if (type != null) {
            media = media.where((m) => m['assetType'] == type).toList();
          }
          return media;
        }
      }
      return [];
    } catch (e) {
      debugPrint('HTTP getMediaAssets error: $e');
      return [];
    }
  }

  // Submit Quiz
  Future<Map<String, dynamic>?> submitQuiz(String challengeId, List<int> answers) async {
    try {
      final response = await _post(
        Uri.parse('$baseUrl/challenges/$challengeId/submit-quiz'),
        headers: _getHeaders(),
        body: jsonEncode({'answers': answers}),
      );

      if (response.statusCode == 200) {
        return (await parseJsonAsync(response.body)) as Map<String, dynamic>?;
      }
      return null;
    } catch (e) {
      debugPrint('HTTP submitQuiz error: $e');
      return null;
    }
  }

  // Submit Task Assignment
  Future<bool> submitTask(String challengeId, String answerText) async {
    try {
      final response = await _post(
        Uri.parse('$baseUrl/submissions'),
        headers: _getHeaders(),
        body: jsonEncode({
          'challengeId': challengeId,
          'answerText': answerText,
        }),
      );

      return response.statusCode == 201;
    } catch (e) {
      debugPrint('HTTP submitTask error: $e');
      return false;
    }
  }

  // Submit Mentor Evaluation
  Future<bool> evaluateMentor(String mentorId, int rating, String comments) async {
    try {
      final response = await _post(
        Uri.parse('$baseUrl/evaluations/mentor'),
        headers: _getHeaders(),
        body: jsonEncode({
          'mentorId': mentorId,
          'ratingValue': rating,
          'seasonEvaluationComments': comments,
        }),
      );

      return response.statusCode == 201;
    } catch (e) {
      debugPrint('HTTP evaluateMentor error: $e');
      return false;
    }
  }

  // --- CARAVAN API ---
  Future<Map<String, dynamic>?> getCaravanDetails(String caravanId) async {
    try {
      final response = await _get(Uri.parse('$baseUrl/caravans/$caravanId'), headers: _getHeaders());
      if (response.statusCode == 200) {
        return (await parseJsonAsync(response.body)) as Map<String, dynamic>?;
      }
      return null;
    } catch (e) {
      debugPrint('HTTP getCaravanDetails error: $e');
      return null;
    }
  }

  // --- CHAT API ---
  Future<List<dynamic>> getDirectMessages(String mentorId) async {
    try {
      final response = await _get(Uri.parse('$baseUrl/chat/direct/$mentorId'), headers: _getHeaders());
      if (response.statusCode == 200) {
        final dynamic data = await parseJsonAsync(response.body);
        if (data is List) return data;
      }
      return [];
    } catch (e) {
      debugPrint('HTTP getDirectMessages error: $e');
      return [];
    }
  }

  Future<List<dynamic>> getCaravanMessages(String caravanId) async {
    try {
      final response = await _get(Uri.parse('$baseUrl/chat/caravan/$caravanId'), headers: _getHeaders());
      if (response.statusCode == 200) {
        final dynamic data = await parseJsonAsync(response.body);
        if (data is List) return data;
      }
      return [];
    } catch (e) {
      debugPrint('HTTP getCaravanMessages error: $e');
      return [];
    }
  }

  Future<bool> sendChatMessage({String? receiverId, String? caravanId, String? text, String? fileUrl, String? fileType}) async {
    try {
      final response = await _post(
        Uri.parse('$baseUrl/chat/send'),
        headers: _getHeaders(),
        body: jsonEncode({
          'receiverId': receiverId,
          'caravanId': caravanId,
          'messageText': text,
          'fileUrl': fileUrl,
          'fileType': fileType,
        }),
      );
      return response.statusCode == 201;
    } catch (e) {
      debugPrint('HTTP sendChatMessage error: $e');
      return false;
    }
  }

  Future<List<Map<String, dynamic>>> getBookmarks(String sessionId) async {
    try {
      final res = await _get(Uri.parse('$baseUrl/lms/bookmarks/$sessionId'), headers: _getHeaders());
      if (res.statusCode == 200) {
        final dynamic data = await parseJsonAsync(res.body);
        if (data is List) {
          return List<Map<String, dynamic>>.from(data);
        }
      }
    } catch (e) {
      debugPrint('Error getting bookmarks: $e');
    }
    return [];
  }

  Future<bool> addBookmark(String sessionId, int videoSeconds, String noteText) async {
    try {
      final res = await _post(
        Uri.parse('$baseUrl/lms/bookmarks'),
        headers: _getHeaders(),
        body: jsonEncode({
          'sessionId': sessionId,
          'videoSeconds': videoSeconds,
          'noteText': noteText,
        }),
      );
      return res.statusCode == 201;
    } catch (e) {
      debugPrint('Error adding bookmark: $e');
      return false;
    }
  }

  Future<Map<String, dynamic>?> sendWatchHeartbeat(String sessionId, int currentPositionSeconds, int durationSeconds) async {
    try {
      final res = await _post(
        Uri.parse('$baseUrl/lms/sessions/$sessionId/heartbeat'),
        headers: _getHeaders(),
        body: jsonEncode({
          'currentPositionSeconds': currentPositionSeconds,
          'durationSeconds': durationSeconds,
        }),
      );
      if (res.statusCode == 200) {
        return (await parseJsonAsync(res.body)) as Map<String, dynamic>?;
      }
    } catch (e) {
      debugPrint('sendWatchHeartbeat error: $e');
    }
    return null;
  }

  Future<Map<String, dynamic>?> getWatchProgress(String sessionId) async {
    try {
      final res = await _get(
        Uri.parse('$baseUrl/lms/sessions/$sessionId/progress'),
        headers: _getHeaders(),
      );
      if (res.statusCode == 200) {
        return (await parseJsonAsync(res.body)) as Map<String, dynamic>?;
      }
    } catch (e) {
      debugPrint('getWatchProgress error: $e');
    }
    return null;
  }

  Future<List<dynamic>> getUserProgress() async {
    try {
      final res = await _get(
        Uri.parse('$baseUrl/lms/user-progress'),
        headers: _getHeaders(),
      );
      if (res.statusCode == 200) {
        final dynamic data = await parseJsonAsync(res.body);
        if (data is List) return data;
      }
    } catch (e) {
      debugPrint('getUserProgress error: $e');
    }
    return [];
  }

  Future<void> markClipWatched(String clipId, {String? trackType, String? stationId, String? sessionId}) async {
    try {
      await _post(
        Uri.parse('$baseUrl/lms/clips/$clipId/watched'),
        headers: _getHeaders(),
        body: jsonEncode({
          'trackType': trackType,
          'stationId': stationId,
          'sessionId': sessionId,
        }),
      );
    } catch (e) {
      debugPrint('markClipWatched error: $e');
    }
  }

  Future<Map<String, dynamic>?> submitClassSessionQuiz(String sessionId, List<dynamic> answers, {String? quizId}) async {
    try {
      final Map<String, dynamic> bodyData = {'answers': answers};
      if (quizId != null) bodyData['quizId'] = quizId;

      final res = await _post(
        Uri.parse('$baseUrl/lms/sessions/$sessionId/submit-quiz'),
        headers: _getHeaders(),
        body: jsonEncode(bodyData),
      );
      if (res.statusCode == 200) {
        return (await parseJsonAsync(res.body)) as Map<String, dynamic>?;
      }
    } catch (e) {
      debugPrint('submitClassSessionQuiz error: $e');
    }
    return null;
  }

  Future<Map<String, dynamic>?> getStudentPerformance(String userId) async {
    try {
      final res = await _get(
        Uri.parse('$baseUrl/admin/users/$userId/analytics'),
        headers: _getHeaders(),
      );
      if (res.statusCode == 200) {
        return (await parseJsonAsync(res.body)) as Map<String, dynamic>?;
      }
    } catch (e) {
      debugPrint('getStudentPerformance error: $e');
    }
    return null;
  }

  // --- Mentor Tickets & Workbench ---
  Future<List<Map<String, dynamic>>> getTickets() async {
    try {
      final response = await _get(
        Uri.parse('$baseUrl/support/tickets'),
        headers: _getHeaders(),
      );
      if (response.statusCode == 200) {
        final dynamic data = await parseJsonAsync(response.body);
        if (data is List) {
          return List<Map<String, dynamic>>.from(data);
        }
      }
      return [];
    } catch (e) {
      debugPrint('HTTP getTickets error: $e');
      return [];
    }
  }

  Future<bool> replyTicket(String ticketId, String replyMessage) async {
    try {
      final response = await _post(
        Uri.parse('$baseUrl/support/tickets/$ticketId/reply'),
        headers: _getHeaders(),
        body: jsonEncode({'message': replyMessage}),
      );
      return response.statusCode == 200 || response.statusCode == 201;
    } catch (e) {
      debugPrint('HTTP replyTicket error: $e');
      return false;
    }
  }

  // --- Create Challenge ---
  Future<bool> createChallenge(ChallengeModel challenge) async {
    try {
      final response = await _post(
        Uri.parse('$baseUrl/challenges'),
        headers: _getHeaders(),
        body: jsonEncode({
          'title': challenge.title,
          'description': challenge.description,
          'rewardZarik': challenge.rewardZarik,
          'type': challenge.type,
          if (challenge.questions != null) 'questions': challenge.questions,
        }),
      );
      return response.statusCode == 200 || response.statusCode == 201;
    } catch (e) {
      debugPrint('HTTP createChallenge error: $e');
      return false;
    }
  }

  // --- Calendar Events ---
  Future<Map<String, dynamic>?> getCalendarEvents() async {
    try {
      final response = await _get(
        Uri.parse('$baseUrl/calendar/events'),
        headers: _getHeaders(),
      );
      if (response.statusCode == 200) {
        return (await parseJsonAsync(response.body)) as Map<String, dynamic>?;
      }
    } catch (e) {
      debugPrint('HTTP getCalendarEvents error: $e');
    }
    return null;
  }

  // --- Mentor Workspace Lifecycle ---
  Future<List<Map<String, dynamic>>> getMentorChallenges() async {
    try {
      final response = await _get(Uri.parse('$baseUrl/mentor/challenges'), headers: _getHeaders());
      if (response.statusCode == 200) {
        final dynamic data = await parseJsonAsync(response.body);
        if (data is List) {
          return List<Map<String, dynamic>>.from(data);
        }
      }
    } catch (e) {
      debugPrint('getMentorChallenges error: $e');
    }
    return [];
  }

  Future<bool> createMentorChallenge(Map<String, dynamic> data) async {
    try {
      final response = await _post(
        Uri.parse('$baseUrl/mentor/challenges'),
        headers: _getHeaders(),
        body: jsonEncode(data),
      );
      return response.statusCode == 200 || response.statusCode == 201;
    } catch (e) {
      debugPrint('createMentorChallenge error: $e');
      return false;
    }
  }

  Future<List<Map<String, dynamic>>> getChallengeSubmissions(String challengeId) async {
    try {
      final response = await _get(Uri.parse('$baseUrl/mentor/challenges/$challengeId/submissions'), headers: _getHeaders());
      if (response.statusCode == 200) {
        final dynamic data = await parseJsonAsync(response.body);
        if (data is List) {
          return List<Map<String, dynamic>>.from(data);
        }
      }
    } catch (e) {
      debugPrint('getChallengeSubmissions error: $e');
    }
    return [];
  }

  Future<Map<String, dynamic>> reviewMentorSubmission(String submissionId, bool approve, int reward, String feedback) async {
    try {
      final response = await _post(
        Uri.parse('$baseUrl/mentor/submissions/$submissionId/review'),
        headers: _getHeaders(),
        body: jsonEncode({
          'status': approve ? 'APPROVED' : 'REJECTED',
          'rewardZarik': reward,
          'mentorFeedback': feedback,
        }),
      );
      if (response.statusCode == 200) {
        return {'success': true};
      } else {
        final d = await parseJsonAsync(response.body);
        return {'success': false, 'error': d?['error'] ?? 'خطای ناشناخته'};
      }
    } catch (e) {
      debugPrint('reviewMentorSubmission error: $e');
      return {'success': false, 'error': 'خطای ارتباط با سرور'};
    }
  }

  Future<Map<String, dynamic>?> getMentorTicketDetails(String ticketId) async {
    try {
      final response = await _get(Uri.parse('$baseUrl/mentor/tickets/$ticketId'), headers: _getHeaders());
      if (response.statusCode == 200) {
        return (await parseJsonAsync(response.body)) as Map<String, dynamic>?;
      }
    } catch (e) {
      debugPrint('getMentorTicketDetails error: $e');
    }
    return null;
  }

  Future<bool> replyMentorTicket(String ticketId, String message) async {
    try {
      final response = await _post(
        Uri.parse('$baseUrl/mentor/tickets/$ticketId/messages'),
        headers: _getHeaders(),
        body: jsonEncode({'message': message}),
      );
      return response.statusCode == 200 || response.statusCode == 201;
    } catch (e) {
      debugPrint('replyMentorTicket error: $e');
      return false;
    }
  }

  // ==================== SUPPORT TICKETS (STUDENTS) ====================
  Future<Map<String, dynamic>?> createTicket({
    required String category,
    required String subject,
    String? voiceUrl,
    String? attachmentUrl,
  }) async {
    try {
      final response = await _post(
        Uri.parse('$baseUrl/support/tickets'),
        headers: _getHeaders(),
        body: jsonEncode({
          'category': category,
          'subject': subject,
          'voiceUrl': voiceUrl,
          'attachmentUrl': attachmentUrl,
        }),
      );
      if (response.statusCode == 200 || response.statusCode == 201) {
        return (await parseJsonAsync(response.body)) as Map<String, dynamic>?;
      }
    } catch (e) {
      debugPrint('createTicket error: $e');
    }
    return null;
  }

  Future<bool> resolveTicket({required String ticketId, int? rating}) async {
    try {
      final response = await _patch(
        Uri.parse('$baseUrl/support/tickets/$ticketId/resolve'),
        headers: _getHeaders(),
        body: jsonEncode({'rating': rating}),
      );
      return response.statusCode == 200;
    } catch (e) {
      debugPrint('resolveTicket error: $e');
      return false;
    }
  }

  // --- Notifications API ---
  Future<Map<String, dynamic>?> getNotifications() async {
    try {
      final response = await _get(
        Uri.parse('$baseUrl/notifications'),
        headers: _getHeaders(),
      );
      if (response.statusCode == 200) {
        return (await parseJsonAsync(response.body)) as Map<String, dynamic>?;
      }
    } catch (e) {
      debugPrint('getNotifications error: $e');
    }
    return null;
  }

  Future<bool> markNotificationAsRead(String notifId) async {
    try {
      final response = await _patch(
        Uri.parse('$baseUrl/notifications/$notifId/read'),
        headers: _getHeaders(),
      );
      return response.statusCode == 200;
    } catch (e) {
      debugPrint('markNotificationAsRead error: $e');
      return false;
    }
  }
}

