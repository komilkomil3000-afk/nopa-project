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
}
