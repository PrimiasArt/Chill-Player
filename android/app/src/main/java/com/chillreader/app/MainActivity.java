package com.chillreader.app;

import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.content.IntentFilter;
import android.content.pm.PackageInfo;
import android.graphics.Bitmap;
import android.graphics.BitmapFactory;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.provider.Settings;
import android.speech.tts.TextToSpeech;
import android.speech.tts.UtteranceProgressListener;
import android.support.v4.media.MediaMetadataCompat;
import android.support.v4.media.session.MediaSessionCompat;
import android.support.v4.media.session.PlaybackStateCompat;
import android.util.Base64;
import android.webkit.JavascriptInterface;
import android.webkit.WebSettings;
import android.webkit.WebView;
import androidx.core.app.NotificationCompat;
import androidx.core.content.FileProvider;
import androidx.media.app.NotificationCompat.MediaStyle;
import com.getcapacitor.BridgeActivity;
import java.io.File;
import java.io.FileOutputStream;
import java.io.InputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.util.Locale;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

public class MainActivity extends BridgeActivity {
    private static final String CHANNEL_ID = "chill_reader_playback_channel";
    private static final int NOTIFICATION_ID = 9021;
    
    private static final String ACTION_PLAY_PAUSE = "com.chillreader.ACTION_PLAY_PAUSE";
    private static final String ACTION_NEXT = "com.chillreader.ACTION_NEXT";
    private static final String ACTION_PREV = "com.chillreader.ACTION_PREV";
    private static final String ACTION_STOP = "com.chillreader.ACTION_STOP";

    private NotificationManager notificationManager;
    private MediaSessionCompat mediaSession;
    private BroadcastReceiver mediaActionReceiver;
    private boolean isReceiverRegistered = false;

    private TextToSpeech nativeTts;
    private boolean isNativeTtsReady = false;

    private final ExecutorService imageExecutor = Executors.newSingleThreadExecutor();
    private volatile String lastCoverUrl = null;
    private volatile Bitmap lastCoverBitmap = null;
    private volatile String loadingCoverUrl = null;

    @Override
    public void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        createNotificationChannel();
        initMediaSession();
        registerMediaReceiver();

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            if (checkSelfPermission(android.Manifest.permission.POST_NOTIFICATIONS) != android.content.pm.PackageManager.PERMISSION_GRANTED) {
                requestPermissions(new String[]{android.Manifest.permission.POST_NOTIFICATIONS}, 101);
            }
        }
        initNativeTts();
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

    private void initMediaSession() {
        if (mediaSession != null) return;
        try {
            mediaSession = new MediaSessionCompat(this, "ChillReaderMediaSession");
            mediaSession.setFlags(
                MediaSessionCompat.FLAG_HANDLES_MEDIA_BUTTONS |
                MediaSessionCompat.FLAG_HANDLES_TRANSPORT_CONTROLS
            );

            mediaSession.setCallback(new MediaSessionCompat.Callback() {
                @Override
                public void onPlay() {
                    sendWebViewCommand("window.ttsEngine && window.ttsEngine.play()");
                }

                @Override
                public void onPause() {
                    sendWebViewCommand("window.ttsEngine && window.ttsEngine.pause()");
                }

                @Override
                public void onSkipToNext() {
                    sendWebViewCommand("window.ttsEngine && window.ttsEngine.nextSentence()");
                }

                @Override
                public void onSkipToPrevious() {
                    sendWebViewCommand("window.ttsEngine && window.ttsEngine.previousSentence()");
                }

                @Override
                public void onStop() {
                    sendWebViewCommand("window.ttsEngine && window.ttsEngine.stop()");
                }

                @Override
                public void onSeekTo(long pos) {
                    int sentenceIdx = (int) (pos / 1000L);
                    sendWebViewCommand("window.ttsEngine && window.ttsEngine.jumpToSentence(" + sentenceIdx + ")");
                }
            });

            mediaSession.setActive(true);
        } catch (Exception e) {
            e.printStackTrace();
        }
    }

    private void sendWebViewCommand(String js) {
        WebView webView = getBridge() != null ? getBridge().getWebView() : null;
        if (webView != null) {
            webView.post(() -> webView.evaluateJavascript(js, null));
        }
    }

    private void createNotificationChannel() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            NotificationChannel channel = new NotificationChannel(
                CHANNEL_ID,
                "Trình phát âm thanh Chill Reader",
                NotificationManager.IMPORTANCE_LOW
            );
            channel.setDescription("Điều khiển âm thanh Chill Reader trong khung phát của Android");
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
                String action = intent != null ? intent.getAction() : null;
                if (action == null) return;

                if (ACTION_PLAY_PAUSE.equals(action)) {
                    sendWebViewCommand("window.ttsEngine && window.ttsEngine.togglePlayPause()");
                } else if (ACTION_NEXT.equals(action)) {
                    sendWebViewCommand("window.ttsEngine && window.ttsEngine.nextSentence()");
                } else if (ACTION_PREV.equals(action)) {
                    sendWebViewCommand("window.ttsEngine && window.ttsEngine.previousSentence()");
                } else if (ACTION_STOP.equals(action)) {
                    sendWebViewCommand("window.ttsEngine && window.ttsEngine.stop()");
                }
            }
        };

        IntentFilter filter = new IntentFilter();
        filter.addAction(ACTION_PLAY_PAUSE);
        filter.addAction(ACTION_NEXT);
        filter.addAction(ACTION_PREV);
        filter.addAction(ACTION_STOP);

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            registerReceiver(mediaActionReceiver, filter, Context.RECEIVER_NOT_EXPORTED);
        } else {
            registerReceiver(mediaActionReceiver, filter);
        }
        isReceiverRegistered = true;
    }

    private void initNativeTts() {
        try {
            nativeTts = new TextToSpeech(getApplicationContext(), status -> {
                if (status == TextToSpeech.SUCCESS) {
                    try {
                        int result = nativeTts.setLanguage(new Locale("vi", "VN"));
                        if (result == TextToSpeech.LANG_MISSING_DATA || result == TextToSpeech.LANG_NOT_SUPPORTED) {
                            nativeTts.setLanguage(new Locale("vi"));
                        }
                    } catch (Exception ignored) {}
                    isNativeTtsReady = true;

                    nativeTts.setOnUtteranceProgressListener(new UtteranceProgressListener() {
                        @Override
                        public void onStart(String utteranceId) {
                            sendWebViewCommand("window.ttsEngine && window.ttsEngine.onNativeUtteranceStart && window.ttsEngine.onNativeUtteranceStart('" + utteranceId + "')");
                        }

                        @Override
                        public void onDone(String utteranceId) {
                            sendWebViewCommand("window.ttsEngine && window.ttsEngine.onNativeUtteranceDone && window.ttsEngine.onNativeUtteranceDone('" + utteranceId + "')");
                        }

                        @Override
                        public void onError(String utteranceId) {
                            sendWebViewCommand("window.ttsEngine && window.ttsEngine.onNativeUtteranceError && window.ttsEngine.onNativeUtteranceError('" + utteranceId + "')");
                        }
                    });
                } else {
                    isNativeTtsReady = false;
                }
            });
        } catch (Exception e) {
            e.printStackTrace();
            isNativeTtsReady = false;
        }
    }

    private class AndroidMediaBridge {
        @JavascriptInterface
        public boolean isNativeTtsReady() {
            return isNativeTtsReady && nativeTts != null;
        }

        @JavascriptInterface
        public void speakNative(String text, float rate, float pitch, String utteranceId) {
            if (nativeTts == null || !isNativeTtsReady) return;
            runOnUiThread(() -> {
                try {
                    nativeTts.setSpeechRate(rate);
                    nativeTts.setPitch(pitch);
                    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.LOLLIPOP) {
                        nativeTts.speak(text, TextToSpeech.QUEUE_FLUSH, null, utteranceId);
                    }
                } catch (Exception e) {
                    e.printStackTrace();
                }
            });
        }

        @JavascriptInterface
        public void stopNative() {
            if (nativeTts != null) {
                runOnUiThread(() -> {
                    try {
                        nativeTts.stop();
                    } catch (Exception ignored) {}
                });
            }
        }

        @JavascriptInterface
        public void updateMedia(String chapterTitle, String bookTitle, String author, boolean isPlaying) {
            updateMedia(chapterTitle, bookTitle, author, isPlaying, "", 0, 0);
        }

        @JavascriptInterface
        public void updateMedia(String chapterTitle, String bookTitle, String author, boolean isPlaying, String coverUrl) {
            updateMedia(chapterTitle, bookTitle, author, isPlaying, coverUrl, 0, 0);
        }

        @JavascriptInterface
        public void updateMedia(
            String chapterTitle, 
            String bookTitle, 
            String author, 
            boolean isPlaying, 
            String coverUrl, 
            int currentSentence, 
            int totalSentences
        ) {
            runOnUiThread(() -> showMediaNotification(
                chapterTitle, 
                bookTitle, 
                author, 
                isPlaying, 
                coverUrl, 
                currentSentence, 
                totalSentences
            ));
        }

        @JavascriptInterface
        public void clearMedia() {
            runOnUiThread(() -> clearMediaInternal());
        }

        @JavascriptInterface
        public String getAppVersionInfo() {
            try {
                PackageInfo pInfo = getPackageManager().getPackageInfo(getPackageName(), 0);
                long vCode = Build.VERSION.SDK_INT >= Build.VERSION_CODES.P 
                    ? pInfo.getLongVersionCode() 
                    : (long) pInfo.versionCode;
                return "{\"versionCode\":" + vCode + ",\"versionName\":\"" + pInfo.versionName + "\"}";
            } catch (Exception e) {
                return "{\"versionCode\":100,\"versionName\":\"1.0.0\"}";
            }
        }

        @JavascriptInterface
        public boolean canInstallApk() {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                return getPackageManager().canRequestPackageInstalls();
            }
            return true;
        }

        @JavascriptInterface
        public void openInstallPermissionSettings() {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                try {
                    Intent intent = new Intent(Settings.ACTION_MANAGE_UNKNOWN_APP_SOURCES);
                    intent.setData(Uri.parse("package:" + getPackageName()));
                    intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
                    startActivity(intent);
                } catch (Exception e) {
                    try {
                        Intent intent = new Intent(Settings.ACTION_SECURITY_SETTINGS);
                        intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
                        startActivity(intent);
                    } catch (Exception ignored) {}
                }
            }
        }

        @JavascriptInterface
        public void downloadAndInstallApk(final String downloadUrl) {
            new Thread(() -> {
                InputStream input = null;
                FileOutputStream output = null;
                HttpURLConnection connection = null;
                try {
                    sendWebViewCommand("window.appUpdater && window.appUpdater.onDownloadProgress && window.appUpdater.onDownloadProgress(0, 100, 0)");
                    
                    URL url = new URL(downloadUrl);
                    connection = (HttpURLConnection) url.openConnection();
                    connection.setInstanceFollowRedirects(true);
                    connection.setConnectTimeout(15000);
                    connection.setReadTimeout(30000);
                    connection.connect();

                    int responseCode = connection.getResponseCode();
                    if (responseCode == HttpURLConnection.HTTP_MOVED_TEMP || 
                        responseCode == HttpURLConnection.HTTP_MOVED_PERM || 
                        responseCode == HttpURLConnection.HTTP_SEE_OTHER) {
                        String newUrl = connection.getHeaderField("Location");
                        connection.disconnect();
                        url = new URL(newUrl);
                        connection = (HttpURLConnection) url.openConnection();
                        connection.setInstanceFollowRedirects(true);
                        connection.setConnectTimeout(15000);
                        connection.setReadTimeout(30000);
                        connection.connect();
                    }

                    int fileLength = connection.getContentLength();
                    input = connection.getInputStream();

                    File cacheDir = getExternalCacheDir();
                    if (cacheDir == null) cacheDir = getCacheDir();
                    final File apkFile = new File(cacheDir, "ChillReader-update.apk");
                    if (apkFile.exists()) {
                        apkFile.delete();
                    }
                    output = new FileOutputStream(apkFile);

                    byte[] data = new byte[8192];
                    long total = 0;
                    int count;
                    long lastProgressTime = 0;

                    while ((count = input.read(data)) != -1) {
                        total += count;
                        output.write(data, 0, count);

                        long now = System.currentTimeMillis();
                        if (now - lastProgressTime > 150 || total == fileLength) {
                            lastProgressTime = now;
                            int percent = fileLength > 0 ? (int) ((total * 100) / fileLength) : -1;
                            final long curTotal = total;
                            final int fLength = fileLength;
                            final int pct = percent;
                            runOnUiThread(() -> {
                                sendWebViewCommand("window.appUpdater && window.appUpdater.onDownloadProgress && window.appUpdater.onDownloadProgress(" + curTotal + ", " + fLength + ", " + pct + ")");
                            });
                        }
                    }

                    output.flush();
                    output.close();
                    output = null;
                    input.close();
                    input = null;

                    runOnUiThread(() -> {
                        sendWebViewCommand("window.appUpdater && window.appUpdater.onDownloadComplete && window.appUpdater.onDownloadComplete()");
                        promptInstallApk(apkFile);
                    });

                } catch (Exception e) {
                    e.printStackTrace();
                    final String errMsg = e.getMessage() != null ? e.getMessage().replace("'", "\\'") : "Lỗi khi tải file cập nhật";
                    runOnUiThread(() -> {
                        sendWebViewCommand("window.appUpdater && window.appUpdater.onDownloadError && window.appUpdater.onDownloadError('" + errMsg + "')");
                    });
                } finally {
                    try {
                        if (output != null) output.close();
                        if (input != null) input.close();
                        if (connection != null) connection.disconnect();
                    } catch (Exception ignored) {}
                }
            }).start();
        }
    }

    private void promptInstallApk(File apkFile) {
        try {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                if (!getPackageManager().canRequestPackageInstalls()) {
                    Intent settingsIntent = new Intent(Settings.ACTION_MANAGE_UNKNOWN_APP_SOURCES);
                    settingsIntent.setData(Uri.parse("package:" + getPackageName()));
                    settingsIntent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
                    startActivity(settingsIntent);
                    sendWebViewCommand("window.appUpdater && window.appUpdater.onPermissionRequired && window.appUpdater.onPermissionRequired()");
                    return;
                }
            }

            Intent intent = new Intent(Intent.ACTION_VIEW);
            Uri apkUri = FileProvider.getUriForFile(
                this, 
                getPackageName() + ".fileprovider", 
                apkFile
            );
            intent.setDataAndType(apkUri, "application/vnd.android.package-archive");
            intent.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION);
            intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
            startActivity(intent);
        } catch (Exception e) {
            e.printStackTrace();
            sendWebViewCommand("window.appUpdater && window.appUpdater.onInstallError && window.appUpdater.onInstallError('" + (e.getMessage() != null ? e.getMessage().replace("'", "\\'") : "Lỗi cài đặt") + "')");
        }
    }

    private void showMediaNotification(
        String chapterTitle,
        String bookTitle,
        String author,
        boolean isPlaying,
        String coverUrl,
        int currentSentence,
        int totalSentences
    ) {
        if (notificationManager == null) {
            notificationManager = (NotificationManager) getSystemService(Context.NOTIFICATION_SERVICE);
        }
        if (notificationManager == null) return;

        initMediaSession();

        String title = (chapterTitle != null && !chapterTitle.trim().isEmpty()) ? chapterTitle.trim() : "Đang phát âm thanh";
        String book = (bookTitle != null && !bookTitle.trim().isEmpty()) ? bookTitle.trim() : "Chill Reader";
        String auth = (author != null && !author.trim().isEmpty()) ? author.trim() : "Chill Reader";
        String subtitle = book;
        if (author != null && !author.trim().isEmpty() && !book.equals(author)) {
            subtitle = book + " · " + author;
        }

        long actions = PlaybackStateCompat.ACTION_PLAY |
                       PlaybackStateCompat.ACTION_PAUSE |
                       PlaybackStateCompat.ACTION_PLAY_PAUSE |
                       PlaybackStateCompat.ACTION_SKIP_TO_NEXT |
                       PlaybackStateCompat.ACTION_SKIP_TO_PREVIOUS |
                       PlaybackStateCompat.ACTION_STOP |
                       PlaybackStateCompat.ACTION_SEEK_TO;

        PlaybackStateCompat.Builder stateBuilder = new PlaybackStateCompat.Builder()
            .setActions(actions)
            .setState(
                isPlaying ? PlaybackStateCompat.STATE_PLAYING : PlaybackStateCompat.STATE_PAUSED,
                (long) currentSentence * 1000L,
                isPlaying ? 1.0f : 0.0f
            );
        if (mediaSession != null) {
            mediaSession.setPlaybackState(stateBuilder.build());
        }

        // Determine cover art bitmap
        Bitmap artBitmap = null;
        if (coverUrl != null && !coverUrl.trim().isEmpty()) {
            String trimmedUrl = coverUrl.trim();
            if (trimmedUrl.equals(lastCoverUrl) && lastCoverBitmap != null) {
                artBitmap = lastCoverBitmap;
            } else if (trimmedUrl.startsWith("data:image")) {
                try {
                    int comma = trimmedUrl.indexOf(',');
                    if (comma > 0) {
                        byte[] decoded = Base64.decode(trimmedUrl.substring(comma + 1), Base64.DEFAULT);
                        Bitmap bmp = BitmapFactory.decodeByteArray(decoded, 0, decoded.length);
                        if (bmp != null) {
                            lastCoverUrl = trimmedUrl;
                            lastCoverBitmap = scaleBitmapIfNeeded(bmp, 512);
                            artBitmap = lastCoverBitmap;
                        }
                    }
                } catch (Exception ignored) {}
            } else if (trimmedUrl.startsWith("http://") || trimmedUrl.startsWith("https://")) {
                if (!trimmedUrl.equals(loadingCoverUrl)) {
                    loadingCoverUrl = trimmedUrl;
                    imageExecutor.execute(() -> {
                        try {
                            URL url = new URL(trimmedUrl);
                            HttpURLConnection conn = (HttpURLConnection) url.openConnection();
                            conn.setConnectTimeout(4000);
                            conn.setReadTimeout(4000);
                            conn.setDoInput(true);
                            conn.connect();
                            InputStream input = conn.getInputStream();
                            Bitmap bmp = BitmapFactory.decodeStream(input);
                            if (bmp != null) {
                                Bitmap scaled = scaleBitmapIfNeeded(bmp, 512);
                                lastCoverUrl = trimmedUrl;
                                lastCoverBitmap = scaled;
                                runOnUiThread(() -> {
                                    if (mediaSession != null && notificationManager != null) {
                                        showMediaNotification(
                                            chapterTitle, 
                                            bookTitle, 
                                            author, 
                                            isPlaying, 
                                            trimmedUrl, 
                                            currentSentence, 
                                            totalSentences
                                        );
                                    }
                                });
                            }
                        } catch (Exception ignored) {
                        } finally {
                            loadingCoverUrl = null;
                        }
                    });
                }
            }
        }

        if (artBitmap == null && lastCoverBitmap != null) {
            artBitmap = lastCoverBitmap;
        }

        if (artBitmap == null) {
            try {
                artBitmap = BitmapFactory.decodeResource(getResources(), R.mipmap.ic_launcher);
            } catch (Exception ignored) {}
        }

        // Update MediaMetadataCompat so Android 11+ System Media Player displays title, artist, album and artwork
        if (mediaSession != null) {
            MediaMetadataCompat.Builder metaBuilder = new MediaMetadataCompat.Builder()
                .putString(MediaMetadataCompat.METADATA_KEY_TITLE, title)
                .putString(MediaMetadataCompat.METADATA_KEY_ARTIST, auth)
                .putString(MediaMetadataCompat.METADATA_KEY_ALBUM, book)
                .putString(MediaMetadataCompat.METADATA_KEY_DISPLAY_TITLE, title)
                .putString(MediaMetadataCompat.METADATA_KEY_DISPLAY_SUBTITLE, subtitle);

            if (totalSentences > 0) {
                metaBuilder.putLong(MediaMetadataCompat.METADATA_KEY_DURATION, (long) totalSentences * 1000L);
            }

            if (artBitmap != null) {
                metaBuilder.putBitmap(MediaMetadataCompat.METADATA_KEY_ALBUM_ART, artBitmap);
                metaBuilder.putBitmap(MediaMetadataCompat.METADATA_KEY_ART, artBitmap);
            }
            mediaSession.setMetadata(metaBuilder.build());
        }

        // PendingIntents for media actions
        int pendingFlags = PendingIntent.FLAG_UPDATE_CURRENT;
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
            pendingFlags |= PendingIntent.FLAG_IMMUTABLE;
        }

        Intent contentIntent = new Intent(this, MainActivity.class);
        contentIntent.setFlags(Intent.FLAG_ACTIVITY_SINGLE_TOP | Intent.FLAG_ACTIVITY_CLEAR_TOP);
        PendingIntent pendingContentIntent = PendingIntent.getActivity(this, 0, contentIntent, pendingFlags);

        Intent prevIntent = new Intent(ACTION_PREV);
        prevIntent.setPackage(getPackageName());
        PendingIntent pendingPrev = PendingIntent.getBroadcast(this, 1, prevIntent, pendingFlags);

        Intent playPauseIntent = new Intent(ACTION_PLAY_PAUSE);
        playPauseIntent.setPackage(getPackageName());
        PendingIntent pendingPlayPause = PendingIntent.getBroadcast(this, 2, playPauseIntent, pendingFlags);

        Intent nextIntent = new Intent(ACTION_NEXT);
        nextIntent.setPackage(getPackageName());
        PendingIntent pendingNext = PendingIntent.getBroadcast(this, 3, nextIntent, pendingFlags);

        Intent stopIntent = new Intent(ACTION_STOP);
        stopIntent.setPackage(getPackageName());
        PendingIntent pendingStop = PendingIntent.getBroadcast(this, 4, stopIntent, pendingFlags);

        MediaStyle mediaStyle = new MediaStyle();
        if (mediaSession != null) {
            mediaStyle.setMediaSession(mediaSession.getSessionToken());
        }
        mediaStyle.setShowActionsInCompactView(0, 1, 2);

        NotificationCompat.Builder builder = new NotificationCompat.Builder(this, CHANNEL_ID)
            .setSmallIcon(R.mipmap.ic_launcher)
            .setContentTitle(title)
            .setContentText(subtitle)
            .setSubText(book)
            .setContentIntent(pendingContentIntent)
            .setDeleteIntent(pendingStop)
            .setOngoing(isPlaying)
            .setOnlyAlertOnce(true)
            .setVisibility(NotificationCompat.VISIBILITY_PUBLIC)
            .setPriority(NotificationCompat.PRIORITY_LOW)
            .setStyle(mediaStyle)
            .addAction(android.R.drawable.ic_media_previous, "Lùi", pendingPrev)
            .addAction(isPlaying ? android.R.drawable.ic_media_pause : android.R.drawable.ic_media_play, isPlaying ? "Tạm dừng" : "Phát", pendingPlayPause)
            .addAction(android.R.drawable.ic_media_next, "Tiếp", pendingNext);

        if (artBitmap != null) {
            builder.setLargeIcon(artBitmap);
        }

        notificationManager.notify(NOTIFICATION_ID, builder.build());
    }

    private void clearMediaInternal() {
        if (mediaSession != null) {
            try {
                PlaybackStateCompat state = new PlaybackStateCompat.Builder()
                    .setState(PlaybackStateCompat.STATE_STOPPED, PlaybackStateCompat.PLAYBACK_POSITION_UNKNOWN, 0.0f)
                    .build();
                mediaSession.setPlaybackState(state);
                mediaSession.setActive(false);
            } catch (Exception ignored) {}
        }
        if (notificationManager != null) {
            notificationManager.cancel(NOTIFICATION_ID);
        }
    }

    private Bitmap scaleBitmapIfNeeded(Bitmap bitmap, int maxDimension) {
        if (bitmap == null) return null;
        int width = bitmap.getWidth();
        int height = bitmap.getHeight();
        if (width <= maxDimension && height <= maxDimension) return bitmap;
        float ratio = Math.min((float) maxDimension / width, (float) maxDimension / height);
        int newWidth = Math.max(1, Math.round(ratio * width));
        int newHeight = Math.max(1, Math.round(ratio * height));
        return Bitmap.createScaledBitmap(bitmap, newWidth, newHeight, true);
    }

    @Override
    public void onDestroy() {
        super.onDestroy();
        if (isReceiverRegistered && mediaActionReceiver != null) {
            try {
                unregisterReceiver(mediaActionReceiver);
            } catch (Exception ignored) {}
            isReceiverRegistered = false;
        }
        clearMediaInternal();
        if (mediaSession != null) {
            try {
                mediaSession.release();
            } catch (Exception ignored) {}
            mediaSession = null;
        }
        if (nativeTts != null) {
            try {
                nativeTts.stop();
                nativeTts.shutdown();
            } catch (Exception ignored) {}
            nativeTts = null;
            isNativeTtsReady = false;
        }
        imageExecutor.shutdown();
    }
}
