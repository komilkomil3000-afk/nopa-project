import 'dart:async';
import 'dart:convert';
import 'dart:io' show InternetAddressType, NetworkInterface, SocketException;
import 'dart:io' as io show File;
import 'package:http/http.dart' as http;
import '../models/models.dart';
import '../core/constants/api_constants.dart';
import 'package:flutter/foundation.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';

class HttpApiService {
  static const String _cachedHostKey = 'cached_backend_host';
  static const String _defaultHost = ApiConstants.hostIp;
  static final String _envHost = const String.fromEnvironment('NOPA_BACKEND_HOST');

  static final HttpApiService _instance = HttpApiService._internal();
  factory HttpApiService() => _instance;
  HttpApiService._internal();

  static const _secureStorage = FlutterSecureStorage();
  static VoidCallback? onUnauthorized;
  static VoidCallback? onActivity;

  String _activeHost = _defaultHost;
  String get activeHost => _activeHost;
  late String _activeBaseUrl = ApiConstants.baseUrl;
  String get baseUrl => _activeBaseUrl;

  String? _token;
  String? get token => _token;
  String? _refreshToken;
  String? get refreshToken => _refreshToken;
  DateTime? _tokenExpiry;
  DateTime? get tokenExpiry => _tokenExpiry;
  bool get isAuthenticated => _token != null && _token!.isNotEmpty;

  bool _isHandling401 = false;
  bool _isRefreshing = false;
  Completer<bool>? _refreshCompleter;

  /// Offload JSON decoding to a background isolate when payload exceeds 10KB
  static Future<dynamic> parseJsonAsync(String source) async {
    try {
      if (source.isEmpty) return null;
      if (source.length > 10240) {
        return compute(_isolateJsonDecode, source);
      }
      return jsonDecode(source);
    } catch (e) {
      debugPrint('⚠️ [HttpApiService] JSON parse error: $e');
      return null;
    }
  }

  static dynamic _isolateJsonDecode(String source) {
    try {
      return jsonDecode(source);
    } catch (_) {
      return null;
    }
  }

  /// Automatic token invalidation on 401 Unauthorized when silent refresh is unrecoverable
  void handleUnauthorized() {
    if (_isHandling401) return;
    _isHandling401 = true;
    debugPrint('🚨 [HttpApiService] 401 Unauthorized unrecoverable! Clearing tokens and routing to /auth...');

    clearTokens().catchError((e) {
      debugPrint('Failed to clear tokens on unauthorized: $e');
    });

    Future.microtask(() {
      onUnauthorized?.call();
    });

    Future.delayed(const Duration(seconds: 2), () {
      _isHandling401 = false;
    });
  }

  /// Persists access_token, refresh_token, and expiration in secure storage and memory
  Future<void> setAuthTokens({
    required String? token,
    String? refreshToken,
    DateTime? expiresAt,
  }) async {
    _token = token;
    if (refreshToken != null) {
      _refreshToken = refreshToken;
    }
    if (expiresAt != null) {
      _tokenExpiry = expiresAt;
    }

    try {
      if (token != null) {
        await _secureStorage.write(key: 'auth_token', value: token);
      } else {
        await _secureStorage.delete(key: 'auth_token');
      }

      if (refreshToken != null) {
        await _secureStorage.write(key: 'refresh_token', value: refreshToken);
      } else if (token == null) {
        await _secureStorage.delete(key: 'refresh_token');
      }

      if (expiresAt != null) {
        await _secureStorage.write(key: 'token_expiry', value: expiresAt.toIso8601String());
      } else if (token == null) {
        await _secureStorage.delete(key: 'token_expiry');
      }
    } catch (e) {
      debugPrint('⚠️ [HttpApiService] Error persisting tokens to secure storage: $e');
    }
  }

  Future<void> setToken(String? token) async {
    await setAuthTokens(token: token);
  }

  Future<void> clearTokens() async {
    _token = null;
    _refreshToken = null;
    _tokenExpiry = null;
    try {
      await _secureStorage.delete(key: 'auth_token');
      await _secureStorage.delete(key: 'refresh_token');
      await _secureStorage.delete(key: 'token_expiry');
    } catch (e) {
      debugPrint('⚠️ [HttpApiService] Error clearing tokens from secure storage: $e');
    }
  }

  /// Silent Auto-Refresh: seamlessly exchanges the refresh token for a fresh access token
  Future<bool> silentRefreshToken() async {
    // If a refresh is already in flight, await the existing future to prevent race conditions
    if (_isRefreshing) {
      if (_refreshCompleter != null) {
        return await _refreshCompleter!.future;
      }
      return false;
    }

    if (_refreshToken == null || _refreshToken!.isEmpty) {
      try {
        _refreshToken = await _secureStorage.read(key: 'refresh_token');
      } catch (e) {
        debugPrint('⚠️ [HttpApiService] Failed to read refresh_token: $e');
      }
    }

    if (_refreshToken == null || _refreshToken!.isEmpty) {
      debugPrint('⚠️ [HttpApiService] No refresh token available for silent refresh.');
      return false;
    }

    _isRefreshing = true;
    _refreshCompleter = Completer<bool>();

    try {
      final refreshUrl = Uri.parse('$baseUrl/auth/refresh');
      debugPrint('🔄 [HttpApiService] Silent refresh requesting: POST $refreshUrl');
      final res = await http.post(
        refreshUrl,
        headers: {'Content-Type': 'application/json'},
        body: jsonEncode({'refreshToken': _refreshToken}),
      ).timeout(const Duration(seconds: 20));

      if (res.statusCode == 200) {
        final dynamic parsed = await parseJsonAsync(res.body);
        if (parsed is Map<String, dynamic>) {
          final String? newToken = parsed['accessToken'] ?? parsed['token'];
          final String? newRefreshToken = parsed['refreshToken'];
          final String? expiresAtStr = parsed['expiresAt'];
          final int? expiresIn = parsed['expiresIn'] as int?;

          if (newToken != null && newToken.isNotEmpty) {
            DateTime? expiresAt;
            if (expiresAtStr != null) {
              expiresAt = DateTime.tryParse(expiresAtStr);
            } else if (expiresIn != null) {
              expiresAt = DateTime.now().add(Duration(seconds: expiresIn));
            }

            await setAuthTokens(
              token: newToken,
              refreshToken: newRefreshToken ?? _refreshToken,
              expiresAt: expiresAt,
            );

            debugPrint('✨ [HttpApiService] Silent refresh succeeded! New access token secured.');
            _refreshCompleter?.complete(true);
            return true;
          }
        }
      }

      debugPrint('❌ [HttpApiService] Silent refresh rejected (status ${res.statusCode})');
      _refreshCompleter?.complete(false);
      return false;
    } catch (e) {
      debugPrint('❌ [HttpApiService] Silent refresh exception: $e');
      _refreshCompleter?.complete(false);
      return false;
    } finally {
      _isRefreshing = false;
      _refreshCompleter = null;
    }
  }

  /// Network Interceptor: handles token injection, silent 401 refresh interception, and request replay
  Future<http.Response> _sendWithAuthRetry(
    String method,
    Uri url, {
    Map<String, String>? headers,
    Object? body,
    bool checkAuth = true,
  }) async {
    final stopwatch = Stopwatch()..start();
    debugPrint('🌐 [HttpApiService] ➡️ $method $url');
    try {
      if (checkAuth) {
        onActivity?.call();
      }
      final reqHeaders = headers ?? _getHeaders();
      http.Response response;

      switch (method.toUpperCase()) {
        case 'GET':
          response = await http.get(url, headers: reqHeaders).timeout(const Duration(seconds: 20));
          break;
        case 'POST':
          response = await http.post(url, headers: reqHeaders, body: body).timeout(const Duration(seconds: 20));
          break;
        case 'PATCH':
          response = await http.patch(url, headers: reqHeaders, body: body).timeout(const Duration(seconds: 20));
          break;
        case 'DELETE':
          response = await http.delete(url, headers: reqHeaders, body: body).timeout(const Duration(seconds: 20));
          break;
        case 'PUT':
          response = await http.put(url, headers: reqHeaders, body: body).timeout(const Duration(seconds: 20));
          break;
        default:
          response = await http.get(url, headers: reqHeaders).timeout(const Duration(seconds: 20));
      }

      debugPrint('📡 [HttpApiService] ⬅️ $method $url -> Status: ${response.statusCode} (${stopwatch.elapsedMilliseconds}ms)');

      // If 401 occurs on an authenticated route, attempt silent refresh and replay once seamlessly
      if (checkAuth && response.statusCode == 401) {
        debugPrint('🔄 [HttpApiService] 401 encountered for $url. Initiating silent refresh...');
        final bool refreshed = await silentRefreshToken();
        if (refreshed && _token != null) {
          debugPrint('🔁 [HttpApiService] Replaying original $method request after silent refresh: $url');
          final replayedHeaders = Map<String, String>.from(headers ?? _getHeaders());
          replayedHeaders['Authorization'] = 'Bearer $_token';

          switch (method.toUpperCase()) {
            case 'GET':
              return await http.get(url, headers: replayedHeaders).timeout(const Duration(seconds: 20));
            case 'POST':
              return await http.post(url, headers: replayedHeaders, body: body).timeout(const Duration(seconds: 20));
            case 'PATCH':
              return await http.patch(url, headers: replayedHeaders, body: body).timeout(const Duration(seconds: 20));
            case 'DELETE':
              return await http.delete(url, headers: replayedHeaders, body: body).timeout(const Duration(seconds: 20));
            case 'PUT':
              return await http.put(url, headers: replayedHeaders, body: body).timeout(const Duration(seconds: 20));
          }
        } else {
          handleUnauthorized();
        }
      }

      return response;
    } on SocketException catch (e) {
      debugPrint('⚠️ [HttpApiService] ❌ Network drop / SocketException for $url (${stopwatch.elapsedMilliseconds}ms): $e');
      return http.Response('{"error":"Network connection lost. Please check your internet.","offline":true}', 503);
    } on TimeoutException catch (e) {
      debugPrint('⚠️ [HttpApiService] ⏱️ TIMEOUT ($method $url) after ${stopwatch.elapsedMilliseconds}ms: $e');
      return http.Response('{"error":"Request timed out. Please try again.","timeout":true}', 504);
    } catch (e) {
      debugPrint('⚠️ [HttpApiService] ❌ Network exception for $url (${stopwatch.elapsedMilliseconds}ms): $e');
      return http.Response('{"error":"Network communication failed: $e"}', 500);
    }
  }

  /// Internal HTTP wrappers with automatic silent refresh & crash resilience
  Future<http.Response> _get(Uri url, {Map<String, String>? headers, bool checkAuth = true}) async {
    return _sendWithAuthRetry('GET', url, headers: headers, checkAuth: checkAuth);
  }

  Future<http.Response> _post(Uri url, {Map<String, String>? headers, Object? body, bool checkAuth = true}) async {
    return _sendWithAuthRetry('POST', url, headers: headers, body: body, checkAuth: checkAuth);
  }

  Future<http.Response> _patch(Uri url, {Map<String, String>? headers, Object? body, bool checkAuth = true}) async {
    return _sendWithAuthRetry('PATCH', url, headers: headers, body: body, checkAuth: checkAuth);
  }

  Future<http.Response> _delete(Uri url, {Map<String, String>? headers, Object? body, bool checkAuth = true}) async {
    return _sendWithAuthRetry('DELETE', url, headers: headers, body: body, checkAuth: checkAuth);
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

  /// Loads saved access token, refresh token, and expiration timestamp from secure storage
  Future<void> loadSavedTokens() async {
    try {
      _token = await _secureStorage.read(key: 'auth_token');
      _refreshToken = await _secureStorage.read(key: 'refresh_token');
      final expiryStr = await _secureStorage.read(key: 'token_expiry');
      if (expiryStr != null) {
        _tokenExpiry = DateTime.tryParse(expiryStr);
      }
      debugPrint('🔑 Loaded cached tokens -> AccessToken: ${_token != null ? "exists" : "null"}, RefreshToken: ${_refreshToken != null ? "exists" : "null"}, Expiry: $_tokenExpiry');
    } catch (e) {
      debugPrint('⚠️ [HttpApiService] Failed to read tokens from secure storage: $e');
    }
  }

  /// Fast-path backend health check that uses cached IP to eliminate startup UI freezes
  Future<void> checkBackendHealth() async {
    await loadSavedTokens();

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

  Map<String, String> _getHeaders() {
    return {
      'Content-Type': 'application/json',
      if (_token != null) 'Authorization': 'Bearer $_token',
    };
  }

  // Auth & Login
  Future<Map<String, dynamic>> verifyPhone(String phoneNumber, {String? websiteSource}) async {
    final targetUrl = Uri.parse('$baseUrl/auth/verify-phone');
    debugPrint('📱 [HttpApiService:VerifyPhone] Requesting $targetUrl for phone: $phoneNumber');
    try {
      final bodyMap = <String, dynamic>{'phoneNumber': phoneNumber};
      if (websiteSource != null) {
        bodyMap['website_source'] = websiteSource;
      }

      final response = await _post(
        targetUrl,
        headers: {'Content-Type': 'application/json'},
        body: jsonEncode(bodyMap),
        checkAuth: false,
      );

      final dynamic parsed = await parseJsonAsync(response.body);
      final Map<String, dynamic> data = (parsed is Map<String, dynamic>) ? parsed : {};

      if (response.statusCode == 200) {
        return {
          'status': 'success',
          'statusCode': 200,
          'success': true,
          'message': data['message'] ?? 'کد تأیید با موفقیت ارسال شد',
          ...data,
        };
      }

      if (response.statusCode == 429) {
        int retryAfter = 120;
        final headerRetry = response.headers['retry-after'];
        if (headerRetry != null) {
          retryAfter = int.tryParse(headerRetry) ?? retryAfter;
        } else if (data['retryAfter'] != null) {
          retryAfter = (data['retryAfter'] as num).toInt();
        }

        return {
          'status': 'rate_limited',
          'statusCode': 429,
          'success': false,
          'retryAfter': retryAfter,
          'message': data['error'] ?? data['message'] ?? 'لطفاً $retryAfter ثانیه دیگر دوباره تلاش کنید.',
          ...data,
        };
      }

      return {
        'status': 'error',
        'statusCode': response.statusCode,
        'success': false,
        'message': data['error'] ?? data['message'] ?? 'خطایی در بررسی شماره رخ داد',
        ...data,
      };
    } catch (e) {
      debugPrint('Verify phone error: $e');
      return {
        'status': 'error',
        'success': false,
        'message': 'خطای ارتباط با سرور. لطفاً اتصال اینترنت خود را بررسی کنید.',
      };
    }
  }

  Future<Map<String, dynamic>> sendOtp(String phoneNumber, {String? websiteSource}) async {
    return verifyPhone(phoneNumber, websiteSource: websiteSource);
  }

  Future<dynamic> login(String phoneNumber, {String? password, String? role}) async {
    final targetUrl = Uri.parse('$baseUrl/auth/login');
    debugPrint('🔑 [HttpApiService:Login] Requesting $targetUrl for phone: $phoneNumber');
    try {
      final bodyMap = <String, dynamic>{'phoneNumber': phoneNumber};
      if (password != null) bodyMap['password'] = password;
      if (role != null) bodyMap['role'] = role;
      
      final response = await _post(
        targetUrl,
        headers: {'Content-Type': 'application/json'},
        body: jsonEncode(bodyMap),
        checkAuth: false,
      );

      final data = await parseJsonAsync(response.body);

      if (response.statusCode == 300) {
        return {'status': 'multiple_profiles', 'profiles': data['profiles']};
      }

      if (response.statusCode == 200) {
        final accessToken = data['accessToken'] ?? data['token'];
        final refreshToken = data['refreshToken'];
        final expiresAtStr = data['expiresAt'];
        DateTime? expiresAt;
        if (expiresAtStr != null) {
          expiresAt = DateTime.tryParse(expiresAtStr);
        } else if (data['expiresIn'] != null) {
          expiresAt = DateTime.now().add(Duration(seconds: (data['expiresIn'] as num).toInt()));
        }

        await setAuthTokens(
          token: accessToken,
          refreshToken: refreshToken,
          expiresAt: expiresAt,
        );
        return {'status': 'success', 'data': data};
      }
      
      if (response.statusCode == 429) {
        int retryAfter = 120;
        final headerRetry = response.headers['retry-after'];
        if (headerRetry != null) {
          retryAfter = int.tryParse(headerRetry) ?? retryAfter;
        } else if (data is Map && data['retryAfter'] != null) {
          retryAfter = (data['retryAfter'] as num).toInt();
        }
        return {
          'status': 'rate_limited',
          'statusCode': 429,
          'success': false,
          'retryAfter': retryAfter,
          'message': data?['error'] ?? data?['message'] ?? 'لطفاً $retryAfter ثانیه دیگر دوباره تلاش کنید.',
          if (data is Map<String, dynamic>) ...data,
        };
      }

      return {'status': 'error', 'message': data?['message'] ?? data?['error'] ?? 'خطایی رخ داده است'};
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
        final accessToken = data['accessToken'] ?? data['token'];
        final refreshToken = data['refreshToken'];
        final expiresAtStr = data['expiresAt'];
        DateTime? expiresAt;
        if (expiresAtStr != null) {
          expiresAt = DateTime.tryParse(expiresAtStr);
        } else if (data['expiresIn'] != null) {
          expiresAt = DateTime.now().add(Duration(seconds: (data['expiresIn'] as num).toInt()));
        }

        await setAuthTokens(
          token: accessToken,
          refreshToken: refreshToken,
          expiresAt: expiresAt,
        );
        return {'status': 'success', 'data': data};
      }

      if (response.statusCode == 429) {
        int retryAfter = 120;
        final headerRetry = response.headers['retry-after'];
        if (headerRetry != null) {
          retryAfter = int.tryParse(headerRetry) ?? retryAfter;
        } else if (data is Map && data['retryAfter'] != null) {
          retryAfter = (data['retryAfter'] as num).toInt();
        }
        return {
          'status': 'rate_limited',
          'statusCode': 429,
          'success': false,
          'retryAfter': retryAfter,
          'message': data?['error'] ?? data?['message'] ?? 'لطفاً $retryAfter ثانیه دیگر دوباره تلاش کنید.',
          if (data is Map<String, dynamic>) ...data,
        };
      }
      
      return {'status': 'error', 'message': data?['message'] ?? data?['error'] ?? 'خطایی در ثبت‌نام رخ داده است'};
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
        checkAuth: false,
      );
      await clearTokens();
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
  Future<List<ChallengeModel>> getChallenges({int? limit, int? page}) async {
    try {
      final queryParams = <String, String>{};
      if (limit != null) queryParams['limit'] = limit.toString();
      if (page != null) queryParams['page'] = page.toString();

      final uri = queryParams.isNotEmpty
          ? Uri.parse('$baseUrl/challenges').replace(queryParameters: queryParams)
          : Uri.parse('$baseUrl/challenges');

      final response = await _get(
        uri,
        headers: _getHeaders(),
      );

      if (response.statusCode == 200) {
        final dynamic data = await parseJsonAsync(response.body);
        if (data is List) {
          return data.map((json) {
            final creatorInfo = json['creatorInfo'] as Map<String, dynamic>?;
            final caravanInfo = json['caravanInfo'] as Map<String, dynamic>?;
            final targetAudience = json['targetAudience'] as Map<String, dynamic>?;
            final bool isByAdmin = creatorInfo?['isByAdmin'] == true ||
                (json['createdByMentorId'] != null && json['createdByMentorId'].toString().toLowerCase().contains('admin'));
            final String creatorName = creatorInfo?['name'] ?? (isByAdmin ? 'مدیر سیستم' : (caravanInfo?['mentorName'] ?? 'راهبر'));
            final String targetLabel = targetAudience?['label'] ?? (caravanInfo?['name'] != null ? 'کاروان: ${caravanInfo!['name']}' : 'عمومی (همه کاروان‌ها)');
            final String? category = json['category'] ?? json['targetScope'] ?? json['scope'];
            final DateTime? createdAt = json['createdAt'] != null ? DateTime.tryParse(json['createdAt'].toString()) : null;
            final int durationDays = json['durationDays'] ?? 5;

            return ChallengeModel(
              id: json['id'],
              title: json['title'],
              description: json['description'],
              rewardZarik: json['rewardZarik'] ?? 50,
              type: json['type'],
              questions: json['questions'] != null ? List<Map<String, dynamic>>.from(json['questions']) : null,
              createdByMentorId: json['createdByMentorId'] ?? '',
              progress: 0.0,
              caravanId: json['caravanId'],
              mentorName: creatorName,
              caravanName: caravanInfo?['name'],
              myStatus: json['myStatus'] ?? json['mySubmission']?['status'],
              mentorFeedback: json['mySubmission']?['mentorFeedback'],
              myAnswerText: json['mySubmission']?['answerText'],
              isByAdmin: isByAdmin,
              creatorName: creatorName,
              targetAudienceLabel: targetLabel,
              category: category,
              createdAt: createdAt,
              durationDays: durationDays,
            );
          }).toList();
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
    return ApiConstants.resolveImageUrl(url);
  }

  // Get Course Classes
  // In-memory caches for LMS and Static Resources
  List<Map<String, dynamic>>? _cachedStations;
  List<Map<String, dynamic>>? _cachedClasses;
  List<Map<String, dynamic>>? _cachedNews;
  final Map<String, List<Map<String, dynamic>>> _cachedBanners = {};

  /// Invalidate cached LMS data to force a fresh fetch
  void clearLmsCache() {
    _cachedStations = null;
    _cachedClasses = null;
    _cachedNews = null;
    _cachedBanners.clear();
    debugPrint('🧹 [HttpApiService] LMS in-memory cache cleared');
  }

  // Get Course Classes (with in-memory cache)
  Future<List<Map<String, dynamic>>> getClasses({bool forceRefresh = false}) async {
    if (!forceRefresh && _cachedClasses != null && _cachedClasses!.isNotEmpty) {
      return _cachedClasses!;
    }
    try {
      final response = await _get(
        Uri.parse('$baseUrl/classes'),
        headers: _getHeaders(),
      );

      if (response.statusCode == 200) {
        final dynamic data = await parseJsonAsync(response.body);
        if (data is List) {
          _cachedClasses = List<Map<String, dynamic>>.from(data);
          return _cachedClasses!;
        }
      }
      return _cachedClasses ?? [];
    } catch (e) {
      debugPrint('HTTP getClasses error: $e');
      return _cachedClasses ?? [];
    }
  }

  static final Map<String, dynamic> stationZeroData = {
    'id': 'station_0',
    'title': 'منزلگاه صفر (راهنمای کاروان)',
    'subtitle': 'آشنایی با مسیر کاروان و اطلاعات کلی در مورد تمامی منزلگاه‌ها',
    'instructors': 'راهبر ارشد کاروان',
    'teacher': 'راهبر ارشد کاروان',
    'orderIndex': 0,
    'iconUrl': 'https://images.unsplash.com/photo-1516321318423-f06f85e504b3?w=500',
    'imageUrl': 'https://images.unsplash.com/photo-1516321318423-f06f85e504b3?w=500',
    'categories': [
      {
        'id': 'cat_s0_intro',
        'title': 'راهنمای سفر و آشنایی با منزلگاه‌ها',
        'orderIndex': 0,
        'sessions': [
          {
            'id': 'sess_s0_1',
            'title': 'فیلم اول: معرفی مسیر کاروان و نقشه راه',
            'name': 'فیلم اول: معرفی مسیر کاروان و نقشه راه',
            'orderIndex': 0,
            'maxZarikReward': 50,
            'videoClips': [
              {
                'id': 'clip_s0_1',
                'title': 'فیلم اول: معرفی مسیر کاروان و نقشه راه کلیه منزلگاه‌ها',
                'clipOrder': 1,
                'videoUrl': 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4',
                'durationSeconds': 240,
                'description': 'در این فیلم کوتاه با اهداف کاروان نپا، نحوه عبور از منزلگاه‌ها و قوانین مسیر آشنا می‌شوید.',
              },
            ],
          },
          {
            'id': 'sess_s0_2',
            'title': 'فیلم دوم: راهنمای چالش‌ها، کلاس‌ها و زریک',
            'name': 'فیلم دوم: راهنمای چالش‌ها، کلاس‌ها و زریک',
            'orderIndex': 1,
            'maxZarikReward': 50,
            'videoClips': [
              {
                'id': 'clip_s0_2',
                'title': 'فیلم دوم: راهنمای چالش‌ها، کلاس‌ها و زریک',
                'clipOrder': 1,
                'videoUrl': 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerEscapes.mp4',
                'durationSeconds': 180,
                'description': 'در این فیلم با نحوه شرکت در کلاس‌ها، آزمون‌های زریک و تکمیل تکالیف ویژه آشنا می‌شوید.',
              },
            ],
          },
        ],
      },
    ],
  };

  // Get Stations (with in-memory cache and Station 0 guaranteed)
  Future<List<Map<String, dynamic>>> getStations({bool forceRefresh = false, int? limit, int? page}) async {
    if (!forceRefresh && _cachedStations != null && _cachedStations!.isNotEmpty && limit == null && page == null) {
      return _cachedStations!;
    }
    try {
      final queryParams = <String, String>{};
      if (limit != null) queryParams['limit'] = limit.toString();
      if (page != null) queryParams['page'] = page.toString();

      final uri = queryParams.isNotEmpty
          ? Uri.parse('$baseUrl/lms/stations').replace(queryParameters: queryParams)
          : Uri.parse('$baseUrl/lms/stations');

      final response = await _get(
        uri,
        headers: _getHeaders(),
      );

      List<Map<String, dynamic>> list = [];
      if (response.statusCode == 200) {
        final dynamic data = await parseJsonAsync(response.body);
        if (data is List) {
          list = List<Map<String, dynamic>>.from(data);
        }
      }

      // Ensure Station 0 is always at index 0
      final bool hasStation0 = list.any((s) =>
          s['id'] == 'station_0' ||
          s['orderIndex'] == 0 ||
          s['title'].toString().contains('صفر'));
      if (!hasStation0) {
        list.insert(0, Map<String, dynamic>.from(stationZeroData));
      }

      _cachedStations = list;
      return _cachedStations!;
    } catch (e) {
      debugPrint('HTTP getStations error: $e');
      if (_cachedStations == null || _cachedStations!.isEmpty) {
        _cachedStations = [Map<String, dynamic>.from(stationZeroData)];
      }
      return _cachedStations!;
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

  Future<List<Map<String, dynamic>>> getNews({bool forceRefresh = false, int? limit, int? page}) async {
    if (!forceRefresh && _cachedNews != null && _cachedNews!.isNotEmpty && limit == null && page == null) {
      return _cachedNews!;
    }
    try {
      final queryParams = <String, String>{};
      if (limit != null) queryParams['limit'] = limit.toString();
      if (page != null) queryParams['page'] = page.toString();

      final uri = queryParams.isNotEmpty
          ? Uri.parse('$baseUrl/news').replace(queryParameters: queryParams)
          : Uri.parse('$baseUrl/news');

      final response = await _get(uri, headers: _getHeaders());
      if (response.statusCode == 200) {
        final dynamic data = await parseJsonAsync(response.body);
        if (data is List) {
          _cachedNews = List<Map<String, dynamic>>.from(data);
          return _cachedNews!;
        }
      }
      return _cachedNews ?? [];
    } catch (e) {
      debugPrint('getNews error: $e');
      return _cachedNews ?? [];
    }
  }

  Future<List<Map<String, dynamic>>> getBanners({String? position, bool forceRefresh = false, int? limit}) async {
    final cacheKey = position ?? 'all';
    if (!forceRefresh && _cachedBanners.containsKey(cacheKey) && _cachedBanners[cacheKey]!.isNotEmpty && limit == null) {
      return _cachedBanners[cacheKey]!;
    }
    try {
      final queryParams = <String, String>{};
      if (position != null) queryParams['position'] = position;
      if (limit != null) queryParams['limit'] = limit.toString();

      final uri = queryParams.isNotEmpty
          ? Uri.parse('$baseUrl/banners').replace(queryParameters: queryParams)
          : Uri.parse('$baseUrl/banners');

      final response = await _get(uri, headers: _getHeaders());
      if (response.statusCode == 200) {
        final dynamic data = await parseJsonAsync(response.body);
        if (data is List) {
          final list = List<Map<String, dynamic>>.from(data);
          _cachedBanners[cacheKey] = list;
          return list;
        }
      }
      return _cachedBanners[cacheKey] ?? [];
    } catch (e) {
      debugPrint('getBanners error: $e');
      return _cachedBanners[cacheKey] ?? [];
    }
  }

  Future<List<Map<String, dynamic>>> getAdminBanners({bool forceRefresh = false}) async {
    try {
      final response = await _get(Uri.parse('$baseUrl/admin/banners'), headers: _getHeaders());
      if (response.statusCode == 200) {
        final dynamic data = await parseJsonAsync(response.body);
        if (data is List) {
          return List<Map<String, dynamic>>.from(data);
        }
      }
      return await getBanners(forceRefresh: forceRefresh);
    } catch (e) {
      debugPrint('getAdminBanners error: $e');
      return await getBanners(forceRefresh: forceRefresh);
    }
  }

  Future<Map<String, dynamic>?> createBanner({
    required String title,
    String? targetRoute,
    String position = 'home_top',
    bool isActive = true,
    int orderIndex = 0,
    io.File? imageFile,
  }) async {
    try {
      final uri = Uri.parse('$baseUrl/admin/banners');
      final request = http.MultipartRequest('POST', uri);
      if (_token != null) request.headers['Authorization'] = 'Bearer $_token';
      request.fields['title'] = title;
      if (targetRoute != null && targetRoute.isNotEmpty) {
        request.fields['targetRoute'] = targetRoute;
      }
      request.fields['position'] = position;
      request.fields['isActive'] = isActive.toString();
      request.fields['orderIndex'] = orderIndex.toString();

      if (imageFile != null) {
        final multipartFile = await http.MultipartFile.fromPath('image', imageFile.path);
        request.files.add(multipartFile);
      }

      final streamed = await request.send();
      final resp = await http.Response.fromStream(streamed);
      if (resp.statusCode == 201 || resp.statusCode == 200) {
        _cachedBanners.clear();
        return await parseJsonAsync(resp.body) as Map<String, dynamic>?;
      }
      debugPrint('createBanner failed: ${resp.statusCode} ${resp.body}');
      return null;
    } catch (e) {
      debugPrint('createBanner error: $e');
      return null;
    }
  }

  Future<Map<String, dynamic>?> updateBanner({
    required String id,
    String? title,
    String? targetRoute,
    String? position,
    bool? isActive,
    int? orderIndex,
    io.File? imageFile,
  }) async {
    try {
      final uri = Uri.parse('$baseUrl/admin/banners/$id');
      final request = http.MultipartRequest('PUT', uri);
      if (_token != null) request.headers['Authorization'] = 'Bearer $_token';
      if (title != null) request.fields['title'] = title;
      if (targetRoute != null) request.fields['targetRoute'] = targetRoute;
      if (position != null) request.fields['position'] = position;
      if (isActive != null) request.fields['isActive'] = isActive.toString();
      if (orderIndex != null) request.fields['orderIndex'] = orderIndex.toString();

      if (imageFile != null) {
        final multipartFile = await http.MultipartFile.fromPath('image', imageFile.path);
        request.files.add(multipartFile);
      }

      final streamed = await request.send();
      final resp = await http.Response.fromStream(streamed);
      if (resp.statusCode == 200) {
        _cachedBanners.clear();
        return await parseJsonAsync(resp.body) as Map<String, dynamic>?;
      }
      debugPrint('updateBanner failed: ${resp.statusCode} ${resp.body}');
      return null;
    } catch (e) {
      debugPrint('updateBanner error: $e');
      return null;
    }
  }

  Future<bool> deleteBanner(String id) async {
    try {
      final response = await _delete(Uri.parse('$baseUrl/admin/banners/$id'), headers: _getHeaders());
      if (response.statusCode == 200 || response.statusCode == 204) {
        _cachedBanners.clear();
        return true;
      }
      return false;
    } catch (e) {
      debugPrint('deleteBanner error: $e');
      return false;
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
  Future<List<Map<String, dynamic>>> getPendingSubmissions({int? limit, int? page}) async {
    try {
      final queryParams = <String, String>{};
      if (limit != null) queryParams['limit'] = limit.toString();
      if (page != null) queryParams['page'] = page.toString();

      final uri = queryParams.isNotEmpty
          ? Uri.parse('$baseUrl/submissions/pending').replace(queryParameters: queryParams)
          : Uri.parse('$baseUrl/submissions/pending');

      final response = await _get(uri, headers: _getHeaders());
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
  Future<List<dynamic>> getDirectMessages(String mentorId, {int? limit}) async {
    try {
      final queryParams = <String, String>{};
      if (limit != null) queryParams['limit'] = limit.toString();

      final uri = queryParams.isNotEmpty
          ? Uri.parse('$baseUrl/chat/direct/$mentorId').replace(queryParameters: queryParams)
          : Uri.parse('$baseUrl/chat/direct/$mentorId');

      final response = await _get(uri, headers: _getHeaders());
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

  Future<List<dynamic>> getCaravanMessages(String caravanId, {int? limit}) async {
    try {
      final queryParams = <String, String>{};
      if (limit != null) queryParams['limit'] = limit.toString();

      final uri = queryParams.isNotEmpty
          ? Uri.parse('$baseUrl/chat/caravan/$caravanId').replace(queryParameters: queryParams)
          : Uri.parse('$baseUrl/chat/caravan/$caravanId');

      final response = await _get(uri, headers: _getHeaders());
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
  Future<List<Map<String, dynamic>>> getTickets({int? limit, int? page, String? status}) async {
    try {
      final queryParams = <String, String>{};
      if (limit != null) queryParams['limit'] = limit.toString();
      if (page != null) queryParams['page'] = page.toString();
      if (status != null) queryParams['status'] = status;

      final uri = queryParams.isNotEmpty
          ? Uri.parse('$baseUrl/support/tickets').replace(queryParameters: queryParams)
          : Uri.parse('$baseUrl/support/tickets');

      final response = await _get(
        uri,
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

  // --- Mentor Caravan Progress API ---
  Future<Map<String, dynamic>?> getMentorCaravanProgress() async {
    try {
      final response = await _get(
        Uri.parse('$baseUrl/mentor/caravan-progress'),
        headers: _getHeaders(),
      );
      if (response.statusCode == 200) {
        return (await parseJsonAsync(response.body)) as Map<String, dynamic>?;
      }
    } catch (e) {
      debugPrint('getMentorCaravanProgress error: $e');
    }
    return null;
  }
}


