import 'dart:convert';
import 'dart:io';
import 'package:flutter/foundation.dart';

class EmbeddedServer {
  static final EmbeddedServer _instance = EmbeddedServer._internal();
  factory EmbeddedServer() => _instance;
  EmbeddedServer._internal();

  HttpServer? _server;
  bool _isRunning = false;
  bool get isRunning => _isRunning;

  // In-Memory Database State
  final Map<String, dynamic> _users = {};
  final List<Map<String, dynamic>> _caravans = [];
  final List<Map<String, dynamic>> _challenges = [];
  final List<Map<String, dynamic>> _submissions = [];
  final List<Map<String, dynamic>> _notifications = [];
  final List<Map<String, dynamic>> _evaluations = [];

  void _seedData() {
    _users.clear();
    _caravans.clear();
    _challenges.clear();
    _submissions.clear();
    _notifications.clear();
    _evaluations.clear();
  }

  Future<void> start() async {
    if (_isRunning) return;
    _seedData();
    try {
      _server = await HttpServer.bind(InternetAddress.anyIPv4, 3000);
      _isRunning = true;
      debugPrint('🚀 Embedded Dart server listening on http://localhost:3000');

      _server!.listen((HttpRequest request) async {
        _handleRequest(request);
      });
    } catch (e) {
      debugPrint('❌ Failed to start embedded Dart server: $e');
    }
  }

  Future<void> stop() async {
    if (!_isRunning) return;
    await _server?.close(force: true);
    _server = null;
    _isRunning = false;
    debugPrint('🛑 Embedded Dart server stopped');
  }

  Future<void> _handleRequest(HttpRequest request) async {
    final response = request.response;
    _applyCorsHeaders(response);

    if (request.method == 'OPTIONS') {
      response.statusCode = HttpStatus.ok;
      await response.close();
      return;
    }

    final path = request.uri.path;
    final method = request.method;

    try {
      // 1. Auth: /api/v1/auth/login
      if (path == '/api/v1/auth/login' && method == 'POST') {
        final bodyStr = await utf8.decoder.bind(request).join();
        final body = jsonDecode(bodyStr);
        final phone = body['phoneNumber'];

        // Find user by phone
        Map<String, dynamic>? user;
        for (var u in _users.values) {
          if (u['phoneNumber'] == phone) {
            user = u as Map<String, dynamic>?;
            break;
          }
        }

        if (user != null) {
          _sendJson(response, {
            'token': 'mock_jwt_token_for_${user['id']}',
            'user': user,
          });
        } else {
          _sendError(response, HttpStatus.notFound, 'کاربری با این شماره تلفن یافت نشد');
        }
        return;
      }

      // Read authorization header to find current student/mentor
      final authHeader = request.headers.value(HttpHeaders.authorizationHeader);
      String currentUserId = 'student_1'; // Fallback mockup user
      if (authHeader != null && authHeader.startsWith('Bearer ')) {
        final tokenParts = authHeader.split('_');
        if (tokenParts.length > 3) {
          currentUserId = tokenParts.last;
        }
      }

      // 2. User Info: /api/v1/users/me
      if (path == '/api/v1/users/me' && method == 'GET') {
        final user = _users[currentUserId];
        if (user != null) {
          _sendJson(response, user);
        } else {
          _sendError(response, HttpStatus.notFound, 'کاربر یافت نشد');
        }
        return;
      }

      // 3. Mentor Info: /api/v1/users/mentor/:id
      if (path.startsWith('/api/v1/users/mentor/') && method == 'GET') {
        final mentorId = path.split('/').last;
        final mentor = _users[mentorId];
        if (mentor != null && mentor['role'] == 'mentor') {
          _sendJson(response, {
            'id': mentor['id'],
            'name': mentor['name'],
            'avatarUrl': 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=200',
            'rating': 4.8,
            'caravansCount': 2,
            'membersCount': 22,
            'bio': 'راهبر ارشد سرزمین نپا، مربی تفکر خلاق و سواد رسانه‌ای نوجوانان.',
            'certificates': [
              'گواهی عالی مربیگری تربیتی نپا',
              'گواهی تخصصی رسانه و تولید محتوا',
              'گواهی شایستگی مدیریت کاروان نپا'
            ]
          });
        } else {
          _sendError(response, HttpStatus.notFound, 'راهبر مورد نظر یافت نشد');
        }
        return;
      }

      // 4. Challenges List: /api/v1/challenges (GET) or (POST)
      if (path == '/api/v1/challenges') {
        if (method == 'GET') {
          _sendJson(response, _challenges);
        } else if (method == 'POST') {
          final bodyStr = await utf8.decoder.bind(request).join();
          final body = jsonDecode(bodyStr);
          final newChallenge = {
            'id': 'c_${_challenges.length + 1}',
            'title': body['title'],
            'description': body['description'],
            'type': body['type'],
            'rewardZarik': body['rewardZarik'] ?? 200,
            'createdByMentorId': currentUserId,
            'questions': body['questions'],
          };
          _challenges.add(newChallenge);
          _sendJson(response, newChallenge, status: HttpStatus.created);
        }
        return;
      }

      // 5. Submit Quiz: /api/v1/challenges/:id/submit-quiz (POST)
      if (path.startsWith('/api/v1/challenges/') && path.endsWith('/submit-quiz') && method == 'POST') {
        final parts = path.split('/');
        final challengeId = parts[parts.length - 2];
        final bodyStr = await utf8.decoder.bind(request).join();
        final body = jsonDecode(bodyStr);
        final List<dynamic> answers = body['answers'] ?? [];

        Map<String, dynamic>? challenge;
        for (var c in _challenges) {
          if (c['id'] == challengeId) {
            challenge = c;
            break;
          }
        }
        if (challenge == null || challenge['type'] != 'quiz') {
          _sendError(response, HttpStatus.notFound, 'آزمون یافت نشد');
          return;
        }

        final questionsList = challenge['questions'] as List<dynamic>? ?? [];
        int correctCount = 0;
        for (int i = 0; i < questionsList.length; i++) {
          if (i < answers.length && answers[i] == questionsList[i]['correct']) {
            correctCount++;
          }
        }

        final reward = correctCount * 10;
        final student = _users[currentUserId];
        if (student != null) {
          student['zarikBalance'] = (student['zarikBalance'] ?? 0) + reward;
        }

        final subId = 's_${_submissions.length + 1}';
        final submission = {
          'id': subId,
          'challengeId': challengeId,
          'studentId': currentUserId,
          'status': 'approved',
          'score': correctCount,
          'submittedAt': DateTime.now().toIso8601String(),
        };
        _submissions.add(submission);

        _sendJson(response, {
          'score': correctCount,
          'total': questionsList.length,
          'rewardZarik': reward,
          'zarikBalance': student != null ? student['zarikBalance'] : 0,
          'submissionId': subId,
        });
        return;
      }

      // 6. Submissions List & reviews: /api/v1/submissions
      if (path == '/api/v1/submissions' && method == 'POST') {
        final bodyStr = await utf8.decoder.bind(request).join();
        final body = jsonDecode(bodyStr);
        final newSubmission = {
          'id': 's_${_submissions.length + 1}',
          'challengeId': body['challengeId'],
          'studentId': currentUserId,
          'answerText': body['answerText'],
          'status': 'pending',
          'submittedAt': DateTime.now().toIso8601String(),
        };
        _submissions.add(newSubmission);
        _sendJson(response, newSubmission, status: HttpStatus.created);
        return;
      }

      if (path == '/api/v1/submissions/pending' && method == 'GET') {
        final pending = _submissions.where((s) => s['status'] == 'pending').toList();
        _sendJson(response, pending);
        return;
      }

      if (path.startsWith('/api/v1/submissions/') && path.endsWith('/review') && method == 'PATCH') {
        final subId = path.split('/')[4];
        final bodyStr = await utf8.decoder.bind(request).join();
        final body = jsonDecode(bodyStr);
        final status = body['status']; // "approved" | "rejected"
        final feedback = body['mentorFeedback'];

        final subIndex = _submissions.indexWhere((s) => s['id'] == subId);
        if (subIndex != -1) {
          _submissions[subIndex]['status'] = status;
          _submissions[subIndex]['mentorFeedback'] = feedback;

          final studentId = _submissions[subIndex]['studentId'];
          if (status == 'approved') {
            final student = _users[studentId];
            if (student != null) {
              student['zarikBalance'] = (student['zarikBalance'] ?? 0) + 200; // Reward
            }
          }

          // Notify student
          _notifications.add({
            'id': 'n_${_notifications.length + 1}',
            'userId': studentId,
            'title': status == 'approved' ? 'تکلیف تایید شد ✅' : 'تکلیف رد شد ❌',
            'message': status == 'approved'
                ? 'پاسخ شما تایید شد و پاداش زریک واریز گردید.'
                : 'پاسخ شما رد شد. فیدبک راهبر را بررسی کنید.',
            'type': 'alert',
            'isRead': false,
            'createdAt': DateTime.now().toIso8601String(),
          });

          _sendJson(response, _submissions[subIndex]);
        } else {
          _sendError(response, HttpStatus.notFound, 'تکلیف پیدا نشد');
        }
        return;
      }

      // 7. Leagues
      if (path == '/api/v1/leagues/caravans' && method == 'GET') {
        _sendJson(response, _caravans);
        return;
      }

      if (path == '/api/v1/leagues/wealthiest' && method == 'GET') {
        final students = _users.values.where((u) => u['role'] == 'student').toList();
        students.sort((a, b) => (b['zarikBalance'] ?? 0).compareTo(a['zarikBalance'] ?? 0));
        _sendJson(response, students);
        return;
      }

      if (path == '/api/v1/leagues/mentors' && method == 'GET') {
        final mentors = _users.values.where((u) => u['role'] == 'mentor').toList();
        final mapped = mentors.map((m) => {
          'id': m['id'],
          'name': m['name'],
          'rating': 4.8,
          'reviewsCount': 12,
        }).toList();
        _sendJson(response, mapped);
        return;
      }

      // 8. Evaluations
      if (path == '/api/v1/evaluations/mentor' && method == 'POST') {
        final bodyStr = await utf8.decoder.bind(request).join();
        final body = jsonDecode(bodyStr);
        final rating = {
          'id': 'r_${_evaluations.length + 1}',
          'mentorId': body['mentorId'],
          'studentId': currentUserId,
          'ratingValue': body['ratingValue'],
          'seasonEvaluationComments': body['seasonEvaluationComments'],
        };
        _evaluations.add(rating);

        final student = _users[currentUserId];
        if (student != null) {
          student['hasEvaluatedMentorThisSeason'] = true;
        }

        _sendJson(response, {
          'success': true,
          'ratingId': rating['id'],
          'hasEvaluatedMentorThisSeason': true,
        }, status: HttpStatus.created);
        return;
      }

      // 9. Notifications
      if (path == '/api/v1/notifications' && method == 'GET') {
        final userNotifs = _notifications.where((n) => n['userId'] == currentUserId).toList();
        final unread = userNotifs.where((n) => n['isRead'] == false).length;
        _sendJson(response, {
          'unreadCount': unread,
          'notifications': userNotifs,
        });
        return;
      }

      if (path.startsWith('/api/v1/notifications/') && path.endsWith('/read') && method == 'PATCH') {
        final notifId = path.split('/')[4];
        final index = _notifications.indexWhere((n) => n['id'] == notifId);
        if (index != -1) {
          _notifications[index]['isRead'] = true;
          _sendJson(response, _notifications[index]);
        } else {
          _sendError(response, HttpStatus.notFound, 'پیام پیدا نشد');
        }
        return;
      }

      // 404 handler
      _sendError(response, HttpStatus.notFound, 'سرویس مورد نظر یافت نشد');
    } catch (e) {
      debugPrint('Embedded Server error handling request: $e');
      _sendError(response, HttpStatus.internalServerError, 'خطای داخلی در سرور محلی');
    }
  }

  void _applyCorsHeaders(HttpResponse response) {
    response.headers.add('Access-Control-Allow-Origin', '*');
    response.headers.add('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS');
    response.headers.add('Access-Control-Allow-Headers', 'Origin, Content-Type, Accept, Authorization');
  }

  void _sendJson(HttpResponse response, dynamic data, {int status = HttpStatus.ok}) {
    response.statusCode = status;
    response.headers.contentType = ContentType.json;
    response.write(jsonEncode(data));
    response.close();
  }

  void _sendError(HttpResponse response, int status, String msg) {
    response.statusCode = status;
    response.headers.contentType = ContentType.json;
    response.write(jsonEncode({'error': msg}));
    response.close();
  }
}
