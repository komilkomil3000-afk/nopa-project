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
  });

  factory Station.fromJson(Map<String, dynamic> json) {
    var rawCategories = json['categories'] as List? ?? [];
    return Station(
      id: json['id'] ?? '',
      title: json['title'] ?? 'منزلگاه بدون نام',
      subtitle: json['subtitle']?.toString(),
      teacher: json['teacher'] ?? json['instructors'] ?? 'اساتید منزلگاه',
      progress: (json['progress'] ?? 0).toDouble(),
      isLocked: json['isLocked'] ?? false,
      isCurrent: json['isCurrent'] ?? false,
      imageUrl: json['imageUrl'] ?? 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=800',
      classesCount: json['classesCount'] ?? '${rawCategories.length} دسته کلاس',
      categories: rawCategories.map((c) => ClassCategoryModel.fromJson(c)).toList(),
    );
  }
}
