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
  public isVoiceSupported = false;

  private recordingTimer: any = null;

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

  onVoiceStart(event: Event): void {
    event.preventDefault();
    if (this.ai.isStreaming() || this.ai.isLimitReached() || this.isRecording()) return;
    void this.startVoiceRecording();
  }

  onVoiceEnd(event: Event): void {
    event.preventDefault();
    if (this.isRecording()) {
      void this.stopVoiceRecording();
    }
  }

  cancelRecording(): void {
    void SpeechRecognition.stop();
    this.isRecording.set(false);
    this.clearRecordingTimer();
    this.recordingSeconds.set(0);
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
      const denied = Object.values(status as Record<string, string>).some((v) => v === 'denied');
      if (denied) return;
    } catch {
      return;
    }

    this.isRecording.set(true);
    this.startRecordingTimer();

    try {
      const result = await SpeechRecognition.start({
        language: this.getRecognitionLang(),
        maxResults: 1,
        prompt: '',
        partialResults: false,
        popup: false,
      });

      const transcript = result?.matches?.[0] ?? '';
      if (transcript.trim()) {
        this.inputText = transcript.trim();
        void this.send();
      }
    } catch {
      // cancelled or error — nothing to send
    } finally {
      this.isRecording.set(false);
      this.clearRecordingTimer();
      this.recordingSeconds.set(0);
    }
  }

  private async stopVoiceRecording(): Promise<void> {
    try {
      await SpeechRecognition.stop();
    } catch {}
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
