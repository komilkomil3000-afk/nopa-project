import 'class_model.dart';

class Station {
  final String id;
  final String title;
  final String? subtitle;
  final String teacher;
  final double progress;
  final bool isLocked;
  final bool isCurrent;
  final String imageUrl;
  final String classesCount;
  final List<ClassCategoryModel> categories;
  final int orderIndex;

  Station({
    required this.id,
    required this.title,
    this.subtitle,
    required this.teacher,
    required this.progress,
    required this.isLocked,
    this.isCurrent = false,
    required this.imageUrl,
    this.classesCount = '۲ دسته کلاس',
    this.categories = const [],
    this.orderIndex = 0,
  });

  static const List<String> defaultStationTitles = [
    'منزلگاه صفر (راهنمای کاروان)',
    'منزلگاه اول (کاروانسرای غبارگرفته)',
    'منزلگاه دوم (معدن زیرزمینی)',
    'منزلگاه سوم (قلعه)',
    'منزلگاه چهارم (دهکده ساحلی)',
    'منزلگاه پنجم (فانوس دریایی)',
  ];

  static const List<String> pureStationNames = [
    'راهنمای کاروان',
    'کاروانسرای غبارگرفته',
    'معدن زیرزمینی',
    'قلعه',
    'دهکده ساحلی',
    'فانوس دریایی',
  ];

  static const List<String> ordinalNames = [
    'منزلگاه صفر',
    'منزلگاه اول',
    'منزلگاه دوم',
    'منزلگاه سوم',
    'منزلگاه چهارم',
    'منزلگاه پنجم',
  ];

  static String getOrdinalName(int index) {
    if (index >= 0 && index < ordinalNames.length) {
      return ordinalNames[index];
    }
    return 'منزلگاه $index';
  }

  static String getPureName(int index, [String? originalTitle]) {
    if (index >= 0 && index < pureStationNames.length) {
      return pureStationNames[index];
    }
    if (originalTitle != null && originalTitle.trim().isNotEmpty) {
      String clean = originalTitle.replaceAll(RegExp(r'منزلگاه\s+[\u0600-\u06FF\d]+\s*[\(\:–\-]?\s*'), '');
      clean = clean.replaceAll(RegExp(r'[\(\)]'), '').trim();
      if (clean.isNotEmpty) return clean;
      return originalTitle.trim();
    }
    return 'ایستگاه $index';
  }

  static String resolveTitle(String? originalTitle, int index) {
    if (index == 0) {
      return (originalTitle != null && originalTitle.contains('صفر'))
          ? originalTitle.trim()
          : 'منزلگاه صفر (راهنمای کاروان)';
    }
    if (index >= 0 && index < defaultStationTitles.length) {
      return defaultStationTitles[index];
    }
    if (originalTitle != null && originalTitle.trim().isNotEmpty) {
      return originalTitle.trim();
    }
    return 'منزلگاه $index';
  }

  bool get isCompleted => progress >= 1.0;

  factory Station.fromJson(Map<String, dynamic> json) {
    var rawCategories = json['categories'] as List? ?? [];
    final int idx = (json['orderIndex'] as num?)?.toInt() ?? 0;
    return Station(
      id: json['id'] ?? '',
      title: resolveTitle(json['title']?.toString(), idx),
      subtitle: json['subtitle']?.toString(),
      teacher: json['teacher'] ?? json['instructors'] ?? 'اساتید منزلگاه',
      progress: (json['progress'] ?? 0).toDouble(),
      isLocked: json['isLocked'] ?? false,
      isCurrent: json['isCurrent'] ?? false,
      imageUrl: json['imageUrl'] ?? 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=800',
      classesCount: json['classesCount'] ?? '${rawCategories.length} دسته کلاس',
      categories: rawCategories.map((c) => ClassCategoryModel.fromJson(c)).toList(),
      orderIndex: idx,
    );
  }
}
