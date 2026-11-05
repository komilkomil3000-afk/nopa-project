import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:nopa_app/services/app_update_service.dart';
import 'package:nopa_app/widgets/app_update_dialog.dart';

void main() {
  Widget host(AppUpdateInfo info) => MaterialApp(
        home: Scaffold(
          body: Directionality(textDirection: TextDirection.rtl, child: AppUpdateDialog(info: info)),
        ),
      );

  testWidgets('the new version, its notes and «بعداً» are shown', (tester) async {
    await tester.pumpWidget(host(const AppUpdateInfo(version: '1.2.0', downloadUrl: 'https://x/a.apk', abi: 'arm64-v8a', notes: ['رفع مشکل'])));
    await tester.pump();
    expect(find.textContaining('نسخه‌ی جدید'), findsWidgets);
    expect(find.textContaining('رفع مشکل'), findsWidgets);
    expect(find.text('بعداً'), findsWidgets);
  });

  testWidgets('no file for this phone: says so instead of offering a download', (tester) async {
    await tester.pumpWidget(host(const AppUpdateInfo(version: '1.2.0', downloadUrl: '', abi: 'armeabi-v7a', notes: [])));
    await tester.pump();
    expect(find.textContaining('هنوز منتشر نشده'), findsWidgets);
    expect(find.text('باشه'), findsWidgets);
  });
}
