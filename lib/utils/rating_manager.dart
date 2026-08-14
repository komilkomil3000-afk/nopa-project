class RatingManager {
  static double averageRating = 4.8;
  static int totalRatings = 100;
  
  static final Map<int, int> starDistribution = {
    5: 85,
    4: 10,
    3: 3,
    2: 1,
    1: 1,
  };

  static final List<String> topStrengths = ['برخورد محترمانه', 'توضیحات شفاف', 'پاسخگویی سریع'];
  static final List<String> topWeaknesses = ['کمی تاخیر در پاسخ'];

  static final List<Map<String, dynamic>> comments = [
    {
      'stars': 5,
      'comment': 'بسیار با حوصله و محترمانه تمام اهداف SMART را برای من توضیح دادند.',
    },
    {
      'stars': 5,
      'comment': 'برخورد فوق‌العاده صمیمی و راهنمایی‌های کاملاً کاربردی در طول کل مسیر.',
    },
  ];

  static void addRating(int stars, List<String> strengths, List<String> weaknesses, String comment) {
    totalRatings++;
    starDistribution[stars] = (starDistribution[stars] ?? 0) + 1;
    
    // Recalculate average
    double sum = 0;
    starDistribution.forEach((s, count) {
      sum += s * count;
    });
    averageRating = sum / totalRatings;

    if (comment.isNotEmpty) {
      comments.insert(0, {
        'stars': stars,
        'comment': comment,
      });
    }
  }
}
