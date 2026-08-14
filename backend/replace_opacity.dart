import 'dart:io';

void main() {
  final dir = Directory('lib');
  if (!dir.existsSync()) {
    stdout.writeln('lib directory not found.');
    return;
  }

  final files = dir.listSync(recursive: true).whereType<File>().where((file) => file.path.endsWith('.dart'));

  int totalReplacements = 0;
  for (var file in files) {
    final content = file.readAsStringSync();
    if (content.contains('.withOpacity(')) {
      // Simple regex replacement: withOpacity(value) -> withValues(alpha: value)
      // Since Dart doesn't have a regex replace with match reference built-in as simply, we can use RegExp:
      final regExp = RegExp(r'\.withOpacity\(([^)]+)\)');
      final newContent = content.replaceAllMapped(regExp, (match) {
        final val = match.group(1);
        return '.withValues(alpha: $val)';
      });

      file.writeAsStringSync(newContent);
      stdout.writeln('Updated file: ${file.path}');
      totalReplacements++;
    }
  }

  stdout.writeln('Finished! Updated $totalReplacements files.');
}
