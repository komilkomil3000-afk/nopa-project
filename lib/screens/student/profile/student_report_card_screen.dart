import 'package:flutter/material.dart';
import 'package:nopa_app/models/user_model.dart';
import 'package:nopa_app/screens/student/profile/student_profile_screen.dart';

class StudentReportCardScreen extends StatelessWidget {
  final UserModel? user;
  final List<Map<String, dynamic>> stations;
  final List<Map<String, dynamic>> progressList;

  const StudentReportCardScreen({
    super.key,
    this.user,
    this.stations = const [],
    this.progressList = const [],
  });

  @override
  Widget build(BuildContext context) {
    return const StudentProfileScreen();
  }
}
