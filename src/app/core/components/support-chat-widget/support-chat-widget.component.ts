import {
  AfterViewChecked,
  ChangeDetectionStrategy,
  Component,
  computed,
  DestroyRef,
  effect,
  ElementRef,
  inject,
  signal,
  ViewChild,
  WritableSignal,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { CommonModule, DatePipe } from '@angular/common';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { IonicModule } from '@ionic/angular';
import {
  EChatStatus,
  ESenderType,
  ISupportChatFilters,
  ISupportMessage,
} from '@models/support-chat.interface';
import {
  ESupportChatConnectionStatus,
  SupportChatWebsocketService,
} from '@services/support-chat-websocket.service';
import { SupportChatService } from '@services/support-chat.service';
import { SupervisorService } from '@services/supervisor.service';

@Component({
  selector: 'app-support-chat-widget',
  standalone: true,
  imports: [CommonModule, IonicModule, ReactiveFormsModule, DatePipe],
  templateUrl: './support-chat-widget.component.html',
  styleUrls: ['./support-chat-widget.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SupportChatWidgetComponent implements AfterViewChecked {
  @ViewChild('messagesContainer')
  private messagesContainer?: ElementRef<HTMLDivElement>;

  private readonly destroyRef = inject(DestroyRef);
  private readonly chatService = inject(SupportChatService);
  private readonly wsService = inject(SupportChatWebsocketService);
  private readonly supervisorService = inject(SupervisorService);

  public readonly messageControl = new FormControl('');

  /** Widget open/close state */
  public readonly isOpen: WritableSignal<boolean> = signal(false);

  /** Loading flags */
  public readonly isLoadingHistory: WritableSignal<boolean> = signal(false);
  public readonly isSending: WritableSignal<boolean> = signal(false);

  /** Whether user is scrolled to bottom */
  private shouldScrollToBottom = false;

  /** Track if this is the initial history load */
  private isInitialLoad = true;

  /** Signals from services */
  public readonly messages = this.chatService.messagesSignal;
  public readonly activeChat = this.chatService.activeChatSignal;
  public readonly hasMoreMessages = this.chatService.hasMoreMessagesSignal;
  public readonly unreadCount = this.wsService.unreadCount;
  public readonly connectionStatus = this.wsService.connectionStatus;

  public readonly isConnected = computed(
    () => this.connectionStatus() === ESupportChatConnectionStatus.Connected,
  );

  public readonly isReconnecting = computed(
    () => this.connectionStatus() === ESupportChatConnectionStatus.Connecting,
  );

  public readonly ESenderType = ESenderType;

  constructor() {
    // React to incoming WebSocket messages
    effect(() => {
      const msg = this.wsService.incomingMessage();
      if (msg) {
        this.chatService.appendWsMessage(msg);
        this.shouldScrollToBottom = true;
      }
    });

    // React to chat closed by operator
    effect(() => {
      const closedChatId = this.wsService.chatClosed();
      if (closedChatId) {
        const active = this.activeChat();
        if (active && active._id === closedChatId) {
          this.chatService.activeChatSignal.set({
            ...active,
            status: EChatStatus.Closed,
          });
        }
      }
    });

    // Connect WebSocket when user is authenticated
    effect(() => {
      const user = this.supervisorService.authUserSignal();
      if (user) {
        this.initializeChat();
      }
    });
  }

  ngAfterViewChecked(): void {
    if (this.shouldScrollToBottom) {
      this.scrollToBottom();
      this.shouldScrollToBottom = false;
    }
  }

  /** Initialize: connect WS and load the last open chat (if any). */
  private initializeChat(): void {
    this.wsService.connect();
    this.loadOpenChat();
  }

  /** Load the user's most recent open chat and its messages. */
  private loadOpenChat(): void {
    const filters = this.buildDefaultFilters();

    this.chatService
      .getChats({ ...filters, status: EChatStatus.Open, offset: '0', limit: '1' })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((res) => {
        if (res.results.length > 0) {
          const chat = res.results[0];
          this.chatService.activeChatSignal.set(chat);
          this.wsService.joinChat(chat._id);
          this.loadMessages(chat._id);
        }
      });
  }

  /** Build default query filters based on the current user's role. */
  private buildDefaultFilters(): ISupportChatFilters {
    const user = this.supervisorService.authUserSignal();
    const filters: ISupportChatFilters = {};
    if (!user) return filters;
    if (this.supervisorService.isManager()) {
      filters.appUserId = user._id;
    }
    return filters;
  }

  /** Load messages for a given chat. */
  private loadMessages(chatId: string, offset = 0): void {
    this.isLoadingHistory.set(true);
    this.chatService
      .getMessages(chatId, offset, 50)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          this.isLoadingHistory.set(false);
          if (this.isInitialLoad) {
            this.shouldScrollToBottom = true;
            this.isInitialLoad = false;
          }
        },
        error: () => {
          this.isLoadingHistory.set(false);
        },
      });
  }

  /** Toggle widget open/close. */
  public toggleWidget(): void {
    this.isOpen.update((v) => !v);
    if (this.isOpen()) {
      this.wsService.resetUnreadCount();
      this.shouldScrollToBottom = true;
    }
  }

  /** Close the widget. */
  public closeWidget(): void {
    this.isOpen.set(false);
  }

  /** Send a message. */
  public sendMessage(): void {
    const text = this.messageControl.value?.trim();
    if (!text || this.isSending()) return;

    this.isSending.set(true);

    const activeChat = this.activeChat();
    const payload = activeChat ? { chatId: activeChat._id, text } : { text };

    this.chatService
      .sendMessage(payload)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (res) => {
          this.messageControl.reset();
          this.isSending.set(false);
          this.shouldScrollToBottom = true;

          // If new chat created, join the WS room
          if (!activeChat) {
            this.wsService.joinChat(res.chat._id);
          }
        },
        error: () => {
          this.isSending.set(false);
        },
      });
  }

  /** Close the current chat session. */
  public endChat(): void {
    const chat = this.activeChat();
    if (!chat) return;

    this.chatService
      .closeChat(chat._id)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe();
  }

  /** Start a new chat after the previous was closed. */
  public startNewChat(): void {
    this.chatService.reset();
    this.isInitialLoad = true;
  }

  /** Load older messages (scroll up to load more). */
  public loadMore(): void {
    const chat = this.activeChat();
    if (!chat || this.isLoadingHistory()) return;
    this.loadMessages(chat._id, this.messages().length);
  }

  /** Track messages by ID for @for. */
  public trackByMessageId(_index: number, msg: ISupportMessage): string {
    return msg._id;
  }

  private scrollToBottom(): void {
    if (this.messagesContainer) {
      const el = this.messagesContainer.nativeElement;
      el.scrollTop = el.scrollHeight;
    }
  }
}

