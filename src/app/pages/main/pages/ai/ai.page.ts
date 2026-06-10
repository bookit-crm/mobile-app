import {
  AfterViewChecked,
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  ElementRef,
  OnInit,
  ViewChild,
  effect,
  inject,
} from '@angular/core';
import { TranslateService } from '@ngx-translate/core';
import { AiChatService } from '@core/services/ai-chat.service';

/**
 * AI chat page (mobile).
 *
 * Voice input (mic button + SpeechRecognition plugin) was removed because
 * the native Android plugin crashed the app under certain device states.
 * If/when we want it back, the previous implementation is in git history
 * (last present in commit 418ca73; removed here after that work proved
 * unstable on real devices).
 */
@Component({
  selector: 'app-ai',
  templateUrl: './ai.page.html',
  styleUrls: ['./ai.page.scss'],
  standalone: false,
  host: { class: 'ion-page' },
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AiPage implements AfterViewChecked, OnInit {
  public readonly ai = inject(AiChatService);
  private readonly translate = inject(TranslateService);
  private readonly cdr = inject(ChangeDetectorRef);

  public inputText = '';

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

  async handleRefresh(event: CustomEvent): Promise<void> {
    try {
      await this.ai.loadHistory();
    } finally {
      (event.target as HTMLIonRefresherElement).complete();
    }
  }

  private scrollToBottom(): void {
    try {
      this.messagesEnd?.nativeElement?.scrollIntoView({ behavior: 'smooth' });
    } catch {}
  }
}
