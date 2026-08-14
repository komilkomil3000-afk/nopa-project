const fs = require('fs');
let content = fs.readFileSync('lib/services/api_service.dart', 'utf8');

// Remove the mistakenly appended functions at the end
const startIdx = content.indexOf('  Future<List<Map<String, dynamic>>> getBookmarks');
if (startIdx !== -1) {
    content = content.substring(0, startIdx);
}

// Re-add them properly before the last closing brace of HttpApiService class
const methods = `
  Future<List<Map<String, dynamic>>> getBookmarks(String sessionId) async {
    try {
      final token = await getToken();
      final res = await http.get(Uri.parse('$baseUrl/lms/bookmarks/$sessionId'), headers: {
        'Authorization': 'Bearer $token'
      });
      if (res.statusCode == 200) {
        return List<Map<String, dynamic>>.from(jsonDecode(res.body));
      }
    } catch (e) {
      debugPrint('Error getting bookmarks: $e');
    }
    return [];
  }

  Future<bool> addBookmark(String sessionId, int videoSeconds, String noteText) async {
    try {
      final token = await getToken();
      final res = await http.post(
        Uri.parse('$baseUrl/lms/bookmarks'),
        headers: {
          'Authorization': 'Bearer $token',
          'Content-Type': 'application/json',
        },
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
`;

const classEndIdx = content.lastIndexOf('}');
content = content.substring(0, classEndIdx) + methods + content.substring(classEndIdx);

fs.writeFileSync('lib/services/api_service.dart', content, 'utf8');
