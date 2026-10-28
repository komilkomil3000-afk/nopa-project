import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:provider/provider.dart';
import 'package:nopa_app/main.dart';
import 'package:nopa_app/services/app_state_repository.dart';
import 'package:nopa_app/services/theme_provider.dart';

void main() {
  testWidgets('NepaApp smoke test', (WidgetTester tester) async {
    await tester.pumpWidget(
      MultiProvider(
        providers: [
          ChangeNotifierProvider(create: (_) => AppRepository()),
          ChangeNotifierProvider(create: (_) => ThemeProvider()),
        ],
        child: const NepaApp(),
      ),
    );

    expect(find.byType(MaterialApp), findsOneWidget);
  });
}
