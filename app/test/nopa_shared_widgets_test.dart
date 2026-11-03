import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:nopa_app/widgets/nopa_modal_shell.dart';
import 'package:nopa_app/widgets/nopa_pill_tabs.dart';

Widget _host(Widget child) => MaterialApp(
      home: Scaffold(body: Directionality(textDirection: TextDirection.rtl, child: child)),
    );

void main() {
  group('NopaModalShell', () {
    testWidgets('shows title, child and runs the pressed action', (tester) async {
      var confirmed = 0;
      var cancelled = 0;
      await tester.pumpWidget(_host(NopaModalShell(
        headerIcon: Icons.logout_rounded,
        title: 'عنوان',
        actions: [
          NopaModalAction(label: 'تایید', onPressed: () => confirmed++),
          NopaModalAction(label: 'لغو', variant: NopaModalActionVariant.secondary, onPressed: () => cancelled++),
        ],
        child: const Text('محتوا'),
      )));

      expect(find.text('عنوان'), findsWidgets);
      expect(find.text('محتوا'), findsWidgets);
      expect(find.byIcon(Icons.logout_rounded), findsOneWidget);

      await tester.tap(find.text('تایید').first);
      await tester.tap(find.text('لغو').first);
      expect(confirmed, 1);
      expect(cancelled, 1);
    });

    testWidgets('an action without a callback does nothing', (tester) async {
      await tester.pumpWidget(_host(const NopaModalShell(
        title: 'x',
        actions: [NopaModalAction(label: 'غیرفعال', onPressed: null)],
      )));
      await tester.tap(find.text('غیرفعال').first);
      await tester.pump();
      expect(find.text('غیرفعال'), findsWidgets);
    });

    testWidgets('a loading action ignores taps and shows a spinner', (tester) async {
      var taps = 0;
      await tester.pumpWidget(_host(NopaModalShell(
        title: 'x',
        actions: [NopaModalAction(label: 'ارسال', loading: true, onPressed: () => taps++)],
      )));
      expect(find.byType(CircularProgressIndicator), findsOneWidget);
      expect(find.text('ارسال'), findsNothing);
      await tester.tap(find.byType(CircularProgressIndicator));
      expect(taps, 0);
    });

    testWidgets('showNopaModal returns the popped value', (tester) async {
      int? result;
      await tester.pumpWidget(MaterialApp(
        home: Builder(
          builder: (context) => Scaffold(
            body: TextButton(
              onPressed: () async {
                result = await showNopaModal<int>(
                  context,
                  builder: (ctx) => NopaModalShell(
                    title: 'سوال',
                    actions: [NopaModalAction(label: 'بله', onPressed: () => Navigator.pop(ctx, 7))],
                  ),
                );
              },
              child: const Text('open'),
            ),
          ),
        ),
      ));
      await tester.tap(find.text('open').first);
      await tester.pumpAndSettle();
      expect(find.text('سوال'), findsWidgets);
      await tester.tap(find.text('بله').first);
      await tester.pumpAndSettle();
      expect(result, 7);
      expect(find.text('سوال'), findsNothing);
    });
  });

  group('NopaPillTabs', () {
    testWidgets('reports the tapped tab', (tester) async {
      var selected = 0;
      await tester.pumpWidget(_host(StatefulBuilder(
        builder: (context, setState) => NopaPillTabs<int>(
          selected: selected,
          tabs: const [NopaPillTab(0, 'گزارش اعضا'), NopaPillTab(1, 'مبادلات')],
          onChanged: (v) => setState(() => selected = v),
        ),
      )));
      await tester.tap(find.text('مبادلات').first);
      await tester.pump();
      expect(selected, 1);
    });

    testWidgets('expand mode fills the width', (tester) async {
      await tester.pumpWidget(_host(const NopaPillTabs<int>(
        expand: true,
        selected: 0,
        tabs: [NopaPillTab(0, 'الف'), NopaPillTab(1, 'ب')],
        onChanged: _noop,
      )));
      final size = tester.getSize(find.byType(NopaPillTabs<int>));
      expect(size.width, greaterThan(300));
    });
  });
}

void _noop(int _) {}
