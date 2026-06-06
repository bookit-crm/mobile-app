import {
  AfterViewChecked,
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  ElementRef,
  OnDestroy,
  OnInit,
  ViewChild,
  effect,
  inject,
  signal,
} from '@angular/core';
import { TranslateService } from '@ngx-translate/core';
import { SpeechRecognition } from '@capacitor-community/speech-recognition';
import { AiChatService } from '@core/services/ai-chat.service';

@Component({
  selector: 'app-ai',
  templateUrl: './ai.page.html',
  styleUrls: ['./ai.page.scss'],
  standalone: false,
  host: { class: 'ion-page' },
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AiPage implements AfterViewChecked, OnInit, OnDestroy {
  public readonly ai = inject(AiChatService);
  private readonly translate = inject(TranslateService);
  private readonly cdr = inject(ChangeDetectorRef);

  public inputText = '';

  public readonly isRecording = signal(false);
  public readonly recordingSeconds = signal(0);
  public readonly liveTranscript = signal('');   // partial/live text shown during recording
  public isVoiceSupported = false;

  private recordingTimer: any = null;
  private recognitionActive = false;             // flag to break the restart loop
  private partialListener: any = null;           // PluginListenerHandle for interim results

  @ViewChild('messagesEnd') private messagesEnd!: ElementRef;

  private shouldScroll = false;

  constructor() {
    effect(() => {
      this.ai.messages();
      this.shouldScroll = true;
      this.cdr.markForCheck();
    });
  }

  ngOnInit(): void {
    void this.ai.loadHistory();
    void this.checkVoiceSupport();
  }

  ngAfterViewChecked(): void {
    if (this.shouldScroll) {
      this.scrollToBottom();
      this.shouldScroll = false;
    }
  }

  async send(): Promise<void> {
    const text = this.inputText.trim();
    if (!text || this.ai.isStreaming()) return;
    this.inputText = '';
    await this.ai.sendMessage(text);
  }

  onKeydown(event: KeyboardEvent): void {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      void this.send();
    }
  }

  quickAction(text: string): void {
    this.inputText = text;
    void this.send();
  }

  newChat(): void {
    this.ai.clearConversation();
    this.ai.showHistory.set(false);
  }

  deleteConv(event: Event, id: string): void {
    event.stopPropagation();
    void this.ai.deleteConversation(id);
  }

  formatDate(iso: string): string {
    try {
      const d = new Date(iso);
      const now = new Date();
      const time = d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      const yesterday = new Date(now);
      yesterday.setDate(now.getDate() - 1);
      const todayLabel = this.translate.instant('AI_CHAT_TODAY');
      const yesterdayLabel = this.translate.instant('AI_CHAT_YESTERDAY');
      if (d.toDateString() === now.toDateString()) return `${todayLabel} · ${time}`;
      if (d.toDateString() === yesterday.toDateString()) return `${yesterdayLabel} · ${time}`;
      return d.toLocaleDateString('uk', { day: 'numeric', month: 'short' }) + ' · ' + time;
    } catch {
      return '';
    }
  }

  formatText(text: string): string {
    if (!text) return '';
    return text
      .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
      .replace(/\n/g, '<br>');
  }

  getToolLabel(tool: string): string {
    const key = `AI_TOOL_${tool.toUpperCase()}`;
    const translated = this.translate.instant(key);
    if (translated !== key) return translated;
    return `⚙️ ${tool}...`;
  }

  /** Tap mic in normal state → start recording loop */
  onVoiceStart(event: Event): void {
    event.preventDefault();
    if (this.ai.isStreaming() || this.ai.isLimitReached() || this.isRecording()) return;
    void this.startVoiceRecording();
  }

  /** Tap mic while recording → stop loop, keep text in input for review */
  async stopVoice(): Promise<void> {
    this.recognitionActive = false;
    try { await SpeechRecognition.stop(); } catch {}
  }

  /** Send button while recording → commit live text, stop loop, send */
  async sendFromVoice(): Promise<void> {
    this.recognitionActive = false;
    // Commit any in-progress partial transcript before stop
    const committed = (this.inputText || this.liveTranscript()).trim();
    this.inputText = committed;
    this.liveTranscript.set('');
    try { await SpeechRecognition.stop(); } catch {}
    // Give the loop a tick to exit, then send
    await new Promise<void>((r) => setTimeout(r, 150));
    await this.send();
  }

  /** Cancel button → discard everything */
  cancelRecording(): void {
    this.recognitionActive = false;
    this.inputText = '';
    this.liveTranscript.set('');
    try { SpeechRecognition.stop(); } catch {}
    // Cleanup happens via loop exit; force state reset immediately for UX
    this.isRecording.set(false);
    this.clearRecordingTimer();
    this.recordingSeconds.set(0);
    try { this.partialListener?.remove(); } catch {}
    this.partialListener = null;
    this.cdr.markForCheck();
  }

  formatRecordingTime(): string {
    const s = this.recordingSeconds();
    const mins = Math.floor(s / 60).toString().padStart(2, '0');
    const secs = (s % 60).toString().padStart(2, '0');
    return `${mins}:${secs}`;
  }

  async handleRefresh(event: CustomEvent): Promise<void> {
    try {
      await this.ai.loadHistory();
    } finally {
      (event.target as HTMLIonRefresherElement).complete();
    }
  }

  ngOnDestroy(): void {
    this.cancelRecording();
  }

  private async checkVoiceSupport(): Promise<void> {
    try {
      const { available } = await SpeechRecognition.available();
      this.isVoiceSupported = available;
      this.cdr.markForCheck();
    } catch {
      this.isVoiceSupported = false;
    }
  }

  private async startVoiceRecording(): Promise<void> {
    try {
      const status = await SpeechRecognition.requestPermissions();
      const denied = Object.values(status as unknown as Record<string, string>).some((v) => v === 'denied');
      if (denied) return;
    } catch {
      return;
    }

    this.isRecording.set(true);
    this.recognitionActive = true;
    this.inputText = '';
    this.liveTranscript.set('');
    this.startRecordingTimer();

    // Live partial-results listener — shows what's being recognised in real time
    try {
      this.partialListener = await SpeechRecognition.addListener(
        'partialResults' as any,
        (data: { matches?: string[] }) => {
          const partial = data?.matches?.[0] ?? '';
          this.liveTranscript.set(partial);
          this.cdr.markForCheck();
        }
      );
    } catch {}

    let accumulated = '';
    let consecutiveEmpty = 0;
    const MAX_CONSECUTIVE_EMPTY = 3; // stop after 3 quick empty sessions (emulator / no mic)

    // ── Restart loop ────────────────────────────────────────────────────────
    // Native Android SpeechRecognizer stops automatically on silence (2-5 s).
    // We restart it so the user can keep speaking without tapping again.
    // Exit conditions:
    //   • recognitionActive = false (user tapped stop / send / cancel)
    //   • catch — stop() was called OR hard recognition error
    //   • session returned too quickly with no phrase (emulator / no mic)
    //   • MAX_CONSECUTIVE_EMPTY empty sessions in a row
    while (this.recognitionActive) {
      const sessionStart = Date.now();
      let phrase = '';

      try {
        const result = await SpeechRecognition.start({
          language: this.getRecognitionLang(),
          maxResults: 1,
          partialResults: true,   // enables the partialResults listener above
          popup: false,
          prompt: '',
        });
        phrase = (result?.matches?.[0] ?? '').trim();
      } catch {
        // stop() was called (recognitionActive already false) OR hard error → exit
        break;
      }

      const sessionMs = Date.now() - sessionStart;

      if (phrase && this.recognitionActive) {
        consecutiveEmpty = 0;
        accumulated = accumulated ? `${accumulated} ${phrase}` : phrase;
        this.inputText = accumulated;
        this.liveTranscript.set('');
        this.cdr.markForCheck();
      } else {
        this.liveTranscript.set('');
        consecutiveEmpty++;

        // If recognition ended in < 1.5 s with no speech: mic likely unavailable
        // (emulator, permission issue, audio routing). Don't beep-loop — exit.
        if (sessionMs < 1500 || consecutiveEmpty >= MAX_CONSECUTIVE_EMPTY) {
          break;
        }

        this.cdr.markForCheck();
      }

      // Pause before next session: longer when nothing was heard
      if (this.recognitionActive) {
        await new Promise<void>((r) => setTimeout(r, phrase ? 300 : 800));
      }
    }

    // ── Cleanup ─────────────────────────────────────────────────────────────
    try { this.partialListener?.remove(); } catch {}
    this.partialListener = null;
    this.liveTranscript.set('');
    this.isRecording.set(false);
    this.clearRecordingTimer();
    this.recordingSeconds.set(0);
    this.cdr.markForCheck();
  }

  private startRecordingTimer(): void {
    this.recordingSeconds.set(0);
    this.recordingTimer = setInterval(() => {
      this.recordingSeconds.update((s) => s + 1);
    }, 1000);
  }

  private clearRecordingTimer(): void {
    if (this.recordingTimer) {
      clearInterval(this.recordingTimer);
      this.recordingTimer = null;
    }
  }

  private getRecognitionLang(): string {
    const lang = this.translate.currentLang || this.translate.getBrowserLang() || 'uk';
    const map: Record<string, string> = { uk: 'uk-UA', en: 'en-US', ru: 'ru-RU' };
    return map[lang] ?? 'uk-UA';
  }

  private scrollToBottom(): void {
    try {
      this.messagesEnd?.nativeElement?.scrollIntoView({ behavior: 'smooth' });
    } catch {}
  }
}
