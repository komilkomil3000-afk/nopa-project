import 'dart:convert';
import 'dart:io';

// Mock Databases
Map<String, dynamic> db = {
  'stations': [
    {
      'id': '1',
      'title': 'کاروانسرای غبارگرفته',
      'teacher': 'استاد علوی',
      'progress': 1.0,
      'isLocked': false,
      'isCurrent': false,
      'imageUrl': 'https://images.unsplash.com/photo-1542401886-65d6c61db217?w=800',
      'classesCount': '۴ کلاس',
    },
    {
      'id': '2',
      'title': 'روستای مدفون در شن',
      'teacher': 'استاد محمدی',
      'progress': 1.0,
      'isLocked': false,
      'isCurrent': false,
      'imageUrl': 'https://images.unsplash.com/photo-1509316975850-ff9c5deb0cd9?w=800',
      'classesCount': '۴ کلاس',
    },
    {
      'id': '3',
      'title': 'رصدخانه',
      'teacher': 'استاد رضایی',
      'progress': 0.75,
      'isLocked': false,
      'isCurrent': true,
      'imageUrl': 'https://images.unsplash.com/photo-1506318137071-a8e063b4bec0?w=800',
      'classesCount': '۴ کلاس',
    },
    {
      'id': '4',
      'title': 'کویر تاریک',
      'teacher': 'استاد حسینی',
      'progress': 0.0,
      'isLocked': true,
      'isCurrent': false,
      'imageUrl': 'https://images.unsplash.com/photo-1538370965046-79c0d6907d47?w=800',
      'classesCount': '۴ کلاس',
    },
  ],
  'members': [
    {
      'name': 'امیرحسین رضایی',
      'caravan': 'یاوران علاءالملک',
      'lastActive': '۲ ساعت پیش',
      'initials': 'AR',
      'level': 12,
      'xp': 850,
      'progress': 0.75,
    },
    {
      'name': 'مریم حسینی',
      'caravan': 'یاوران علاءالملک',
      'lastActive': '۴ ساعت پیش',
      'initials': 'MH',
      'level': 10,
      'xp': 400,
      'progress': 0.60,
    }
  ],
  'tickets': [
    {
      'id': '1',
      'user': 'امیرحسین رضایی',
      'type': 'trade',
      'desc': 'مبادله ۵۰۰ زریک به ۱ نخ',
      'time': '۵ دقیقه پیش',
      'status': 'pending',
    }
  ],
  'ratings': [
    {
      'stars': 5,
      'comment': 'بسیار با حوصله و محترمانه تمام اهداف SMART را برای من توضیح دادند.',
    }
  ]
};

void main() async {
  final server = await HttpServer.bind(InternetAddress.loopbackIPv4, 8080);
  stdout.writeln('Nopa App CMS Mock Backend is running on http://${server.address.address}:${server.port}');

  await for (HttpRequest request in server) {
    // Add CORS Headers
    request.response.headers.add('Access-Control-Allow-Origin', '*');
    request.response.headers.add('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    request.response.headers.add('Access-Control-Allow-Headers', 'Content-Type');

    if (request.method == 'OPTIONS') {
      request.response.statusCode = HttpStatus.ok;
      await request.response.close();
      continue;
    }

    final path = request.uri.path;

    if (path == '/api/stations' && request.method == 'GET') {
      _sendJson(request, db['stations']);
    } else if (path == '/api/members' && request.method == 'GET') {
      _sendJson(request, db['members']);
    } else if (path == '/api/tickets') {
      if (request.method == 'GET') {
        _sendJson(request, db['tickets']);
      } else if (request.method == 'POST') {
        final body = await _readBody(request);
        db['tickets'].add(body);
        _sendJson(request, {'status': 'success', 'message': 'Ticket added'});
      }
    } else if (path == '/api/ratings') {
      if (request.method == 'GET') {
        _sendJson(request, db['ratings']);
      } else if (request.method == 'POST') {
        final body = await _readBody(request);
        db['ratings'].add(body);
        _sendJson(request, {'status': 'success', 'message': 'Rating added'});
      }
    } else {
      request.response.statusCode = HttpStatus.notFound;
      request.response.write('Endpoint not found');
      await request.response.close();
    }
  }
}

void _sendJson(HttpRequest request, dynamic data) {
  request.response.headers.contentType = ContentType.json;
  request.response.write(jsonEncode(data));
  request.response.close();
}

Future<dynamic> _readBody(HttpRequest request) async {
  final content = await utf8.decoder.bind(request).join();
  return jsonDecode(content);
}
