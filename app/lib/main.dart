import 'package:flutter/material.dart';

void main() {
  runApp(const PlayMafiaLocalApp());
}

class PlayMafiaLocalApp extends StatelessWidget {
  const PlayMafiaLocalApp({super.key});

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      debugShowCheckedModeBanner: false,
      title: 'Play Mafia Local',
      home: const Scaffold(
        body: Center(
          child: Text('Play Mafia Local'),
        ),
      ),
    );
  }
}