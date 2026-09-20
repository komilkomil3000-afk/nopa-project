const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, 'lib/screens/class_player_screen.dart');
let content = fs.readFileSync(filePath, 'utf8');

// 1. Add Bookmarks State
if (!content.includes('List<Map<String, dynamic>> _bookmarks')) {
  content = content.replace('bool _isQuizUnlocked = false;', 'bool _isQuizUnlocked = false;\n  List<Map<String, dynamic>> _bookmarks = [];\n  bool _isLoadingBookmarks = false;');
}

// 2. Fetch bookmarks in _initializeVideo
content = content.replace('    if (_classes.isEmpty) return;\n    \n    final currentClass = _classes[_currentClassIndex];', '    if (_classes.isEmpty) return;\n    \n    final currentClass = _classes[_currentClassIndex];\n    _fetchBookmarks(currentClass[\'id\']);');

const fetchMethod = `
  Future<void> _fetchBookmarks(String sessionId) async {
    setState(() { _isLoadingBookmarks = true; });
    final bms = await HttpApiService().getBookmarks(sessionId);
    if (mounted) {
      setState(() {
        _bookmarks = bms;
        _isLoadingBookmarks = false;
      });
    }
  }

  void _addBookmark() {
    if (!_videoPlayerController.value.isInitialized) return;
    
    final currentPos = _videoPlayerController.value.position.inSeconds;
    final noteController = TextEditingController();
    
    _videoPlayerController.pause();

    showDialog(
      context: context,
      builder: (ctx) => AlertDialog(
        backgroundColor: const Color(0xFF1E1435),
        title: const Text('افزودن نشانک', style: TextStyle(color: Colors.white, fontFamily: 'Vazirmatn')),
        content: TextField(
          controller: noteController,
          style: const TextStyle(color: Colors.white),
          decoration: const InputDecoration(
            hintText: 'یادداشت خود را بنویسید...',
            hintStyle: TextStyle(color: Colors.white54),
          ),
        ),
        actions: [
          TextButton(
            onPressed: () { Navigator.pop(ctx); _videoPlayerController.play(); },
            child: const Text('انصراف', style: TextStyle(color: Colors.white70)),
          ),
          ElevatedButton(
            onPressed: () async {
              final note = noteController.text.trim();
              if (note.isNotEmpty) {
                final currentClass = _classes[_currentClassIndex];
                await HttpApiService().addBookmark(currentClass['id'], currentPos, note);
                _fetchBookmarks(currentClass['id']);
              }
              Navigator.pop(ctx);
              _videoPlayerController.play();
            },
            style: ElevatedButton.styleFrom(backgroundColor: const Color(0xFFD946EF)),
            child: const Text('ذخیره', style: TextStyle(color: Colors.white)),
          )
        ],
      ),
    );
  }
`;

if (!content.includes('void _addBookmark()')) {
  content = content.replace('  void _proceedWithVideo() {', fetchMethod + '\n  void _proceedWithVideo() {');
}

// 3. Add buffering indicator to video player UI
const bufferingIndicator = `
                  if (_videoPlayerController.value.isBuffering)
                    const Center(child: CircularProgressIndicator(color: Color(0xFFD946EF))),
`;

if (!content.includes('isBuffering')) {
  content = content.replace('                  _buildVideoControls(),\n                ],', '                  _buildVideoControls(),\n' + bufferingIndicator + '                ],');
}

// 4. Add Bookmark UI list below the video
const bookmarkListUI = `
              const SizedBox(height: 24),
              Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  const Text('نشانک‌ها و یادداشت‌ها', style: TextStyle(color: Colors.white, fontSize: 18, fontWeight: FontWeight.bold, fontFamily: 'Vazirmatn')),
                  IconButton(
                    icon: const Icon(Icons.bookmark_add, color: Color(0xFFD946EF)),
                    onPressed: _addBookmark,
                  ),
                ],
              ),
              const SizedBox(height: 12),
              if (_isLoadingBookmarks)
                const Center(child: CircularProgressIndicator())
              else if (_bookmarks.isEmpty)
                const Text('هنوز نشانکی برای این کلاس ثبت نشده است.', style: TextStyle(color: Colors.white54, fontFamily: 'Vazirmatn'))
              else
                ListView.builder(
                  shrinkWrap: true,
                  physics: const NeverScrollableScrollPhysics(),
                  itemCount: _bookmarks.length,
                  itemBuilder: (ctx, i) {
                    final bm = _bookmarks[i];
                    final seconds = bm['videoSeconds'] ?? 0;
                    final mm = (seconds / 60).floor();
                    final ss = seconds % 60;
                    final timeStr = '\${mm.toString().padLeft(2, '0')}:\${ss.toString().padLeft(2, '0')}';
                    return Card(
                      color: Colors.white.withValues(alpha: 0.05),
                      margin: const EdgeInsets.only(bottom: 8),
                      child: ListTile(
                        leading: const Icon(Icons.bookmark, color: Color(0xFFD946EF)),
                        title: Text(bm['noteText'] ?? '', style: const TextStyle(color: Colors.white, fontFamily: 'Vazirmatn')),
                        trailing: TextButton(
                          child: Text(timeStr, style: const TextStyle(color: Color(0xFFFFD54F))),
                          onPressed: () {
                            if (_videoPlayerController.value.isInitialized) {
                              _videoPlayerController.seekTo(Duration(seconds: seconds));
                              _videoPlayerController.play();
                            }
                          },
                        ),
                      ),
                    );
                  }
                ),
`;

if (!content.includes('نشانک‌ها و یادداشت‌ها')) {
  content = content.replace('              const SizedBox(height: 20),\n              \n              if (_classes.length > 1)', bookmarkListUI + '\n              const SizedBox(height: 20),\n              \n              if (_classes.length > 1)');
}

fs.writeFileSync(filePath, content, 'utf8');
console.log('Patched class_player_screen.dart successfully');
