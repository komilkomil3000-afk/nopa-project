import 'package:flutter/material.dart';

class JarchiItem extends StatelessWidget {
  final String title;
  final String date;
  final String imageUrl;
  final String content;
  final String? link;

  const JarchiItem({
    super.key,
    required this.title,
    required this.date,
    required this.imageUrl,
    required this.content,
    this.link,
  });

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: () {
        showDialog(
          context: context,
          builder: (BuildContext context) {
            return Dialog(
              backgroundColor: const Color(0xFF1E1435),
              shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(24)),
              child: Padding(
                padding: const EdgeInsets.all(20),
                child: SingleChildScrollView(
                  child: Directionality(
                    textDirection: TextDirection.rtl,
                    child: Column(
                      mainAxisSize: MainAxisSize.min,
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Row(
                          mainAxisAlignment: MainAxisAlignment.spaceBetween,
                          children: [
                            const Text(
                              'جزئیات اطلاعیه نپا',
                              style: TextStyle(color: Colors.white, fontSize: 15, fontWeight: FontWeight.bold, fontFamily: 'Vazirmatn'),
                            ),
                            IconButton(
                              icon: const Icon(Icons.close, color: Colors.white70),
                              onPressed: () => Navigator.pop(context),
                            ),
                          ],
                        ),
                        const Divider(color: Colors.white10),
                        const SizedBox(height: 12),
                        ClipRRect(
                          borderRadius: BorderRadius.circular(16),
                          child: Image.network(
                            imageUrl,
                            width: double.infinity,
                            height: 140,
                            fit: BoxFit.cover,
                            errorBuilder: (context, error, stackTrace) {
                              return Container(
                                width: double.infinity,
                                height: 140,
                                color: Colors.white10,
                                child: const Icon(Icons.broken_image, color: Colors.white30, size: 40),
                              );
                            },
                          ),
                        ),
                        const SizedBox(height: 14),
                        Text(
                          title, 
                          style: const TextStyle(color: Colors.white, fontSize: 14, fontWeight: FontWeight.bold, fontFamily: 'Vazirmatn'),
                        ),
                        const SizedBox(height: 4),
                        Text(
                          date, 
                          style: const TextStyle(color: Colors.white38, fontSize: 10, fontFamily: 'Vazirmatn'),
                        ),
                        const SizedBox(height: 12),
                        Text(
                          content,
                          style: const TextStyle(color: Colors.white70, fontSize: 12, height: 1.6, fontFamily: 'Vazirmatn'),
                        ),
                        if (link != null) ...[
                          const SizedBox(height: 16),
                          ElevatedButton.icon(
                            onPressed: () {
                              Navigator.pop(context);
                              ScaffoldMessenger.of(context).showSnackBar(
                                SnackBar(
                                  content: Text('در حال باز کردن لینک: $link 🔗', style: const TextStyle(fontFamily: 'Vazirmatn')),
                                  backgroundColor: const Color(0xFF8B5CF6),
                                ),
                              );
                            },
                            icon: const Icon(Icons.open_in_new, size: 16, color: Colors.white),
                            label: const Text(
                              'مشاهده منبع خبر',
                              style: TextStyle(color: Colors.white, fontWeight: FontWeight.bold, fontSize: 12, fontFamily: 'Vazirmatn'),
                            ),
                            style: ElevatedButton.styleFrom(
                              backgroundColor: const Color(0xFFEC4899),
                              shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                              minimumSize: const Size(double.infinity, 44),
                            ),
                          ),
                        ],
                        const SizedBox(height: 16),
                        OutlinedButton(
                          onPressed: () => Navigator.pop(context),
                          style: OutlinedButton.styleFrom(
                            minimumSize: const Size(double.infinity, 44),
                            side: const BorderSide(color: Colors.white38),
                            shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                          ),
                          child: const Text('بستن', style: TextStyle(color: Colors.white, fontFamily: 'Vazirmatn', fontWeight: FontWeight.bold)),
                        ),
                      ],
                    ),
                  ),
                ),
              ),
            );
          },
        );
      },
      child: Directionality(
        textDirection: TextDirection.rtl,
        child: Container(
          margin: const EdgeInsets.only(bottom: 12, left: 20, right: 20),
          padding: const EdgeInsets.all(12),
          decoration: BoxDecoration(
            color: const Color(0xFF1E1435),
            borderRadius: BorderRadius.circular(16),
            border: Border.all(color: Colors.white.withValues(alpha: 0.03)),
          ),
          child: Row(
            children: [
              // Right: Image (renders first on the right in RTL)
              ClipRRect(
                borderRadius: BorderRadius.circular(10),
                child: Image.network(
                  imageUrl,
                  width: 52,
                  height: 52,
                  fit: BoxFit.cover,
                  errorBuilder: (context, error, stackTrace) {
                    return Container(
                      width: 52,
                      height: 52,
                      color: Colors.white10,
                      child: const Icon(Icons.broken_image, color: Colors.white30, size: 20),
                    );
                  },
                ),
              ),
              const SizedBox(width: 12),
              // Middle: Title details
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      title,
                      style: const TextStyle(
                        color: Colors.white,
                        fontWeight: FontWeight.bold,
                        fontSize: 13,
                        fontFamily: 'Vazirmatn',
                      ),
                      maxLines: 2,
                      overflow: TextOverflow.ellipsis,
                    ),
                  ],
                ),
              ),
              const SizedBox(width: 12),
              // Left: Date info (renders on the leftmost side in RTL)
              Text(
                date,
                style: const TextStyle(
                  color: Colors.white38,
                  fontSize: 10,
                  fontFamily: 'Vazirmatn',
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
