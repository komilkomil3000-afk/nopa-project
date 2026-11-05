import 'dart:convert';
import 'class_model.dart';

class StationAnimation {
  final String id;
  final String title;
  final String videoUrl;
  final String? description;
  final String? coverImageUrl;

  StationAnimation({
    required this.id,
    required this.title,
    required this.videoUrl,
    this.description,
    this.coverImageUrl,
  });

  factory StationAnimation.fromJson(Map<String, dynamic> json) {
    return StationAnimation(
      id: json['id']?.toString() ?? '',
      title: json['title']?.toString() ?? 'انیمیشن منزلگاه',
      videoUrl: json['videoUrl']?.toString() ?? json['url']?.toString() ?? '',
      description: json['description']?.toString(),
      coverImageUrl: (json['coverImageUrl']?.toString().trim().isNotEmpty ?? false) ? json['coverImageUrl'].toString().trim() : null,
    );
  }

  Map<String, dynamic> toJson() => {
    'id': id,
    'title': title,
    'videoUrl': videoUrl,
    'description': description,
    'coverImageUrl': coverImageUrl,
  };
}

class Station {
  final String id;
  final String title;
  final String? subtitle;
  final String? description;
  final String? stayDuration;
  final int? animationCount;
  final String? animationTitle;
  final String? animationUrl;
  final List<StationAnimation> animations;
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
    this.description,
    this.stayDuration,
    this.animationCount,
    this.animationTitle,
    this.animationUrl,
    this.animations = const [],
    required this.teacher,
    required this.progress,
    required this.isLocked,
    this.isCurrent = false,
    required this.imageUrl,
    this.classesCount = '',
    this.categories = const [],
    this.orderIndex = 0,
  });

  // All three lists are indexed by the station number (the rank set in the admin panel), so station 0 is index 0.
  static const List<String> defaultStationTitles = [
    'منزلگاه صفر (آغاز راه)',
    'منزلگاه اول (کاروانسرای غبارگرفته)',
    'منزلگاه دوم (معدن زیرزمینی)',
    'منزلگاه سوم (قلعه)',
    'منزلگاه چهارم (دهکده ساحلی)',
    'منزلگاه پنجم (فانوس دریایی)',
  ];

  static const List<String> pureStationNames = [
    'آغاز راه',
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

  static String getOrdinalName(int number) {
    if (number >= 0 && number < ordinalNames.length) return ordinalNames[number];
    return 'منزلگاه $number';
  }

  static String getPureName(int number, [String? originalTitle]) {
    if (originalTitle != null && originalTitle.trim().isNotEmpty) {
      String clean = originalTitle.replaceAll(RegExp(r'منزلگاه\s+[\u0600-\u06FF\d]+\s*[\(\:–\-]?\s*'), '');
      clean = clean.replaceAll(RegExp(r'[\(\)]'), '').trim();
      if (clean.isNotEmpty) return clean;
      return originalTitle.trim();
    }
    if (number >= 0 && number < pureStationNames.length) return pureStationNames[number];
    return 'منزلگاه $number';
  }

  static String resolveTitle(String? originalTitle, int number) {
    if (originalTitle != null && originalTitle.trim().isNotEmpty) {
      return originalTitle.trim();
    }
    if (number >= 0 && number < defaultStationTitles.length) return defaultStationTitles[number];
    return 'منزلگاه $number';
  }

  bool get isCompleted => progress >= 1.0;

  /// The one station picture used everywhere (home, roadmap, station page): the admin-panel image, or empty.
  static String imageFrom(Map<dynamic, dynamic> json) {
    for (final key in const ['iconUrl', 'imageUrl']) {
      final v = json[key]?.toString().trim() ?? '';
      if (v.isNotEmpty) return v;
    }
    // Same fallback as the admin panel's preview: the first gallery picture (a video entry's cover)
    var gallery = json['animations'];
    if (gallery is! List && json['animationsJson'] is String) {
      try {
        gallery = jsonDecode(json['animationsJson'] as String);
      } catch (_) {}
    }
    if (gallery is List) {
      final isImage = RegExp(r'.(jpe?g|png|webp|gif|avif|bmp|svg)$', caseSensitive: false);
      for (final item in gallery) {
        if (item is! Map) continue;
        final cover = item['coverImageUrl']?.toString().trim() ?? '';
        if (cover.isNotEmpty) return cover;
        final url = (item['url'] ?? item['videoUrl'])?.toString().trim() ?? '';
        final path = Uri.tryParse(url)?.path ?? url;
        if (url.isNotEmpty && isImage.hasMatch(path)) return url;
      }
    }
    return '';
  }

  factory Station.fromJson(Map<String, dynamic> json) {
    var rawCategories = json['categories'] as List? ?? [];
    final int idx = (json['orderIndex'] as num?)?.toInt() ?? 0;

    List<StationAnimation> parsedAnimations = [];
    if (json['animations'] is List) {
      for (final item in (json['animations'] as List)) {
        if (item is Map<String, dynamic>) {
          parsedAnimations.add(StationAnimation.fromJson(item));
        } else if (item is Map) {
          parsedAnimations.add(StationAnimation.fromJson(Map<String, dynamic>.from(item)));
        }
      }
    } else if (json['animationsJson'] is String && (json['animationsJson'] as String).trim().isNotEmpty) {
      try {
        final decoded = jsonDecode(json['animationsJson']);
        if (decoded is List) {
          for (final item in decoded) {
            if (item is Map) {
              parsedAnimations.add(StationAnimation.fromJson(Map<String, dynamic>.from(item)));
            }
          }
        }
      } catch (_) {}
    }

    if (parsedAnimations.isEmpty && json['animationUrl'] != null && json['animationUrl'].toString().trim().isNotEmpty) {
      parsedAnimations.add(StationAnimation(
        id: 'anim_${json['id'] ?? '1'}',
        title: json['animationTitle']?.toString() ?? 'انیمیشن معرفی منزلگاه',
        videoUrl: json['animationUrl'].toString(),
        description: json['description']?.toString(),
      ));
    }

    return Station(
      id: json['id'] ?? '',
      title: resolveTitle(json['title']?.toString(), idx),
      subtitle: json['subtitle']?.toString(),
      description: json['description']?.toString(),
      stayDuration: json['stayDuration']?.toString(),
      animationCount: int.tryParse(json['animationCount']?.toString() ?? ''),
      animationTitle: json['animationTitle']?.toString(),
      animationUrl: json['animationUrl']?.toString(),
      animations: parsedAnimations,
      teacher: json['teacher'] ?? json['instructors'] ?? 'اساتید منزلگاه',
      progress: (json['progress'] ?? 0).toDouble(),
      isLocked: json['isLocked'] ?? false,
      isCurrent: json['isCurrent'] ?? false,
      imageUrl: imageFrom(json),
      classesCount: json['classesCount'] ?? (rawCategories.isNotEmpty ? '${rawCategories.length} دسته کلاس' : 'فاقد کلاس (محور انیمیشن)'),
      categories: rawCategories.map((c) => ClassCategoryModel.fromJson(c)).toList(),
      orderIndex: idx,
    );
  }
}
