class ClassModel {
  final String id;
  final String title;
  final String status; // e.g., 'completed', 'in_progress', 'locked'
  final String instructor;

  ClassModel({
    required this.id,
    required this.title,
    required this.status,
    required this.instructor,
  });

  factory ClassModel.fromJson(Map<String, dynamic> json) {
    return ClassModel(
      id: json['id'] ?? '',
      title: json['title'] ?? 'کلاس بدون نام',
      status: json['status'] ?? 'locked',
      instructor: json['instructor'] ?? 'استاد نامشخص',
    );
  }
}
