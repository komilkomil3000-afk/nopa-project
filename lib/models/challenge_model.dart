class ChallengeModel {
  final String id;
  final String title;
  final String description;
  final int reward;
  final double progress;
  final String type; // e.g., 'daily', 'weekly'

  ChallengeModel({
    required this.id,
    required this.title,
    required this.description,
    required this.reward,
    required this.progress,
    required this.type,
  });

  factory ChallengeModel.fromJson(Map<String, dynamic> json) {
    return ChallengeModel(
      id: json['id'] ?? '',
      title: json['title'] ?? 'چالش بدون عنوان',
      description: json['description'] ?? 'بدون توضیحات',
      reward: json['reward'] ?? json['rewardZarik'] ?? 0,
      progress: (json['progress'] ?? 0).toDouble(),
      type: json['type'] ?? 'unknown',
    );
  }
}
