class TasksRepository {
  static bool shouldAutoOpenCreateChallenge = false;
  static final List<Map<String, dynamic>> assignments = [
    {
      'id': '1',
      'title': 'منزلگاه ۳: تکلیف هدف‌گذاری SMART',
      'submissionsCount': '۹ از ۱۲ نفر',
      'submissions': [
        {'name': 'امیرحسین', 'status': 'approved', 'details': 'طراحی اهداف با الگوی SMART به صورت دقیق انجام شده است.'},
        {'name': 'مریم', 'status': 'approved', 'details': 'تکلیف به صورت ویدیویی ارسال شد و تایید شد.'},
        {'name': 'علی', 'status': 'pending', 'details': 'من اهدافم را نوشتم اما مطمئن نیستم که با مدل SMART همخوانی دارد یا خیر.'},
        {'name': 'سارا', 'status': 'rejected', 'details': 'تکلیف هنوز ارسال نشده است.'},
      ]
    }
  ];

  static void addSubmission(String assignmentId, String userName, String details) {
    for (var assign in assignments) {
      if (assign['id'] == assignmentId) {
        final submissions = assign['submissions'] as List<Map<String, String>>;
        submissions.add({
          'name': userName,
          'status': 'pending',
          'details': details,
        });
        assign['submissionsCount'] = '${submissions.length} از ۱۲ نفر';
        break;
      }
    }
  }
}
