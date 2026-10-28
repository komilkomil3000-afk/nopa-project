import 'package:flutter/material.dart';
import 'package:nopa_app/models/user_model.dart';
import 'package:nopa_app/screens/student/profile/student_profile_screen.dart';

class MentorStudentReportCardScreen extends StatelessWidget {
  final UserModel? student;

  const MentorStudentReportCardScreen({super.key, this.student});

  @override
  Widget build(BuildContext context) {
    return const StudentProfileScreen();
  }
}
