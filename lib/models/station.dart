class Station {
  final String id;
  final String title;
  final String teacher;
  final double progress;
  final bool isLocked;
  final bool isCurrent;
  final String imageUrl;
  final String classesCount;

  Station({
    required this.id,
    required this.title,
    required this.teacher,
    required this.progress,
    required this.isLocked,
    this.isCurrent = false,
    required this.imageUrl,
    this.classesCount = '۴ کلاس',
  });

  factory Station.fromJson(Map<String, dynamic> json) {
    return Station(
      id: json['id'] ?? '',
      title: json['title'] ?? 'ایستگاه بدون نام',
      teacher: json['teacher'] ?? 'استاد نامشخص',
      progress: (json['progress'] ?? 0).toDouble(),
      isLocked: json['isLocked'] ?? true,
      isCurrent: json['isCurrent'] ?? false,
      imageUrl: json['imageUrl'] ?? 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=800',
      classesCount: json['classesCount'] ?? '۰ کلاس',
    );
  }
}
