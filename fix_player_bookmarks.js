const fs = require('fs');

const filePath = 'lib/screens/class_player_screen.dart';
let content = fs.readFileSync(filePath, 'utf8');

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
                const Center(child: CircularProgressIndicator(color: Color(0xFFD946EF)))
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
  // Let's replace the Broadcast Link copy box block entirely, or append to it.
  content = content.replace(
    `                              ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('لینک ویدیو کپی شد', style: TextStyle(fontFamily: 'Vazirmatn'))));
                            },
                            child: const Icon(Icons.copy, color: Colors.white70, size: 20),
                          ),
                        ],
                      ),
                    ),`,
    `                              ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('لینک ویدیو کپی شد', style: TextStyle(fontFamily: 'Vazirmatn'))));
                            },
                            child: const Icon(Icons.copy, color: Colors.white70, size: 20),
                          ),
                        ],
                      ),
                    ),` + bookmarkListUI
  );
}

fs.writeFileSync(filePath, content, 'utf8');
