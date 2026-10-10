package com.chillreader.app;

import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.content.IntentFilter;
import android.os.Build;
import android.os.Bundle;
import android.webkit.JavascriptInterface;
import android.webkit.WebSettings;
import android.webkit.WebView;
import androidx.core.app.NotificationCompat;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    private static final String CHANNEL_ID = "chill_reader_playback_channel";
    private static final int NOTIFICATION_ID = 9021;
    
    private static final String ACTION_PLAY_PAUSE = "com.chillreader.ACTION_PLAY_PAUSE";
    private static final String ACTION_NEXT = "com.chillreader.ACTION_NEXT";
    private static final String ACTION_PREV = "com.chillreader.ACTION_PREV";

    private NotificationManager notificationManager;
    private BroadcastReceiver mediaActionReceiver;
    private boolean isReceiverRegistered = false;

    @Override
    public void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        createNotificationChannel();
        registerMediaReceiver();

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            if (checkSelfPermission(android.Manifest.permission.POST_NOTIFICATIONS) != android.content.pm.PackageManager.PERMISSION_GRANTED) {
                requestPermissions(new String[]{android.Manifest.permission.POST_NOTIFICATIONS}, 101);
            }
        }
        setupWebViewBridge();
    }

    @Override
    public void onStart() {
        super.onStart();
        setupWebViewBridge();
    }

    private void setupWebViewBridge() {
        try {
            WebView webView = getBridge() != null ? getBridge().getWebView() : null;
            if (webView != null) {
                WebSettings settings = webView.getSettings();
                settings.setMediaPlaybackRequiresUserGesture(false);
                settings.setDomStorageEnabled(true);
                settings.setDatabaseEnabled(true);
                
                webView.addJavascriptInterface(new AndroidMediaBridge(), "AndroidMedia");
            }
        } catch (Exception e) {
            e.printStackTrace();
        }
    }

    private void createNotificationChannel() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            NotificationChannel channel = new NotificationChannel(
                CHANNEL_ID,
                "Trình phát âm thanh Chill Reader",
                NotificationManager.IMPORTANCE_LOW
            );
            channel.setDescription("Điều khiển nghe audio Chill Reader trên thanh thông báo và màn hình khóa");
            channel.setShowBadge(false);
            channel.setSound(null, null);
            notificationManager = (NotificationManager) getSystemService(Context.NOTIFICATION_SERVICE);
            if (notificationManager != null) {
                notificationManager.createNotificationChannel(channel);
            }
        } else {
            notificationManager = (NotificationManager) getSystemService(Context.NOTIFICATION_SERVICE);
        }
    }

    private void registerMediaReceiver() {
        if (isReceiverRegistered) return;
        mediaActionReceiver = new BroadcastReceiver() {
            @Override
            public void onReceive(Context context, Intent intent) {
                String action = intent.getAction();
                WebView webView = getBridge() != null ? getBridge().getWebView() : null;
                if (webView == null || action == null) return;

                if (ACTION_PLAY_PAUSE.equals(action)) {
                    webView.post(() -> webView.evaluateJavascript("window.ttsEngine && window.ttsEngine.togglePlayPause()", null));
                } else if (ACTION_NEXT.equals(action)) {
                    webView.post(() -> webView.evaluateJavascript("window.ttsEngine && window.ttsEngine.nextSentence()", null));
                } else if (ACTION_PREV.equals(action)) {
                    webView.post(() -> webView.evaluateJavascript("window.ttsEngine && window.ttsEngine.previousSentence()", null));
                }
            }
        };

        IntentFilter filter = new IntentFilter();
        filter.addAction(ACTION_PLAY_PAUSE);
        filter.addAction(ACTION_NEXT);
        filter.addAction(ACTION_PREV);

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            registerReceiver(mediaActionReceiver, filter, Context.RECEIVER_NOT_EXPORTED);
        } else {
            registerReceiver(mediaActionReceiver, filter);
        }
        isReceiverRegistered = true;
    }

    private class AndroidMediaBridge {
        @JavascriptInterface
        public void updateMedia(String chapterTitle, String bookTitle, String author, boolean isPlaying) {
            runOnUiThread(() -> showMediaNotification(chapterTitle, bookTitle, author, isPlaying));
        }

        @JavascriptInterface
        public void clearMedia() {
            runOnUiThread(() -> {
                if (notificationManager != null) {
                    notificationManager.cancel(NOTIFICATION_ID);
                }
            });
        }
    }

    private void showMediaNotification(String chapterTitle, String bookTitle, String author, boolean isPlaying) {
        if (notificationManager == null) return;

        Intent contentIntent = new Intent(this, MainActivity.class);
        contentIntent.setFlags(Intent.FLAG_ACTIVITY_SINGLE_TOP | Intent.FLAG_ACTIVITY_CLEAR_TOP);
        PendingIntent pendingContentIntent = PendingIntent.getActivity(
            this, 0, contentIntent, 
            PendingIntent.FLAG_UPDATE_CURRENT | (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M ? PendingIntent.FLAG_IMMUTABLE : 0)
        );

        Intent prevIntent = new Intent(ACTION_PREV);
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            prevIntent.setPackage(getPackageName());
        }
        PendingIntent pendingPrev = PendingIntent.getBroadcast(
            this, 1, prevIntent,
            PendingIntent.FLAG_UPDATE_CURRENT | (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M ? PendingIntent.FLAG_IMMUTABLE : 0)
        );

        Intent playPauseIntent = new Intent(ACTION_PLAY_PAUSE);
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            playPauseIntent.setPackage(getPackageName());
        }
        PendingIntent pendingPlayPause = PendingIntent.getBroadcast(
            this, 2, playPauseIntent,
            PendingIntent.FLAG_UPDATE_CURRENT | (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M ? PendingIntent.FLAG_IMMUTABLE : 0)
        );

        Intent nextIntent = new Intent(ACTION_NEXT);
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            nextIntent.setPackage(getPackageName());
        }
        PendingIntent pendingNext = PendingIntent.getBroadcast(
            this, 3, nextIntent,
            PendingIntent.FLAG_UPDATE_CURRENT | (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M ? PendingIntent.FLAG_IMMUTABLE : 0)
        );

        String title = (chapterTitle != null && !chapterTitle.isEmpty()) ? chapterTitle : "Đang phát âm thanh";
        String subtitle = (bookTitle != null && !bookTitle.isEmpty()) ? bookTitle : "Chill Reader";
        if (author != null && !author.isEmpty()) {
            subtitle = subtitle + " · " + author;
        }

        NotificationCompat.Builder builder = new NotificationCompat.Builder(this, CHANNEL_ID)
            .setSmallIcon(R.mipmap.ic_launcher)
            .setContentTitle(title)
            .setContentText(subtitle)
            .setContentIntent(pendingContentIntent)
            .setOngoing(isPlaying)
            .setOnlyAlertOnce(true)
            .setVisibility(NotificationCompat.VISIBILITY_PUBLIC)
            .setPriority(NotificationCompat.PRIORITY_LOW)
            .addAction(android.R.drawable.ic_media_previous, "Lùi", pendingPrev)
            .addAction(isPlaying ? android.R.drawable.ic_media_pause : android.R.drawable.ic_media_play, isPlaying ? "Tạm dừng" : "Phát", pendingPlayPause)
            .addAction(android.R.drawable.ic_media_next, "Tiếp", pendingNext);

        notificationManager.notify(NOTIFICATION_ID, builder.build());
    }

    @Override
    public void onDestroy() {
        super.onDestroy();
        if (isReceiverRegistered && mediaActionReceiver != null) {
            try {
                unregisterReceiver(mediaActionReceiver);
            } catch (Exception e) {}
            isReceiverRegistered = false;
        }
        if (notificationManager != null) {
            notificationManager.cancel(NOTIFICATION_ID);
        }
    }
}
