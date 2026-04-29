import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  signal,
} from '@angular/core';
import { AlertController, ToastController } from '@ionic/angular';
import { SubscriptionService } from '@core/services/subscription.service';

export interface ITutorial {
  _id: string;
  title: string;
  description: string;
  duration: string;
  category: 'tutorials';
}

const ALL_TUTORIALS: ITutorial[] = [
  {
    _id: '1',
    title: 'Getting Started',
    description: 'Learn the basics of setting up your account and dashboard',
    duration: '5 min',
    category: 'tutorials',
  },
  {
    _id: '2',
    title: 'Managing Departments',
    description: 'How to create and configure departments effectively',
    duration: '8 min',
    category: 'tutorials',
  },
  {
    _id: '3',
    title: 'Employee Management',
    description: 'Add employees, assign services and set schedules',
    duration: '10 min',
    category: 'tutorials',
  },
  {
    _id: '4',
    title: 'Calendar & Scheduling',
    description: 'Master the booking calendar and scheduling tools',
    duration: '7 min',
    category: 'tutorials',
  },
  {
    _id: '5',
    title: 'Branding & Customization',
    description: 'Customize your booking page with logos and banners',
    duration: '6 min',
    category: 'tutorials',
  },
  {
    _id: '6',
    title: 'Reports & Analytics',
    description: 'Understand your business performance with dashboards',
    duration: '9 min',
    category: 'tutorials',
  },
];

@Component({
  selector: 'app-faq',
  templateUrl: './faq.page.html',
  styleUrls: ['./faq.page.scss'],
  standalone: false,
  host: { class: 'ion-page' },
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class FaqPage {
  public readonly subscriptionService = inject(SubscriptionService);
  private readonly alertCtrl = inject(AlertController);
  private readonly toastCtrl = inject(ToastController);

  // ── State ──────────────────────────────────────────────
  public readonly activeTab = signal<'tutorials'>('tutorials');
  public readonly searchQuery = signal('');

  // ── Filtered list ──────────────────────────────────────
  public readonly filteredTutorials = computed(() => {
    const q = this.searchQuery().toLowerCase().trim();
    if (!q) return ALL_TUTORIALS;
    return ALL_TUTORIALS.filter(
      (t) =>
        t.title.toLowerCase().includes(q) ||
        t.description.toLowerCase().includes(q),
    );
  });

  // ── Subscription ───────────────────────────────────────
  public readonly hasPrioritySupport = computed(() =>
    this.subscriptionService.hasFeature('prioritySupport'),
  );

  // ── Handlers ───────────────────────────────────────────
  public onSearchChange(event: CustomEvent): void {
    this.searchQuery.set((event.detail.value as string) ?? '');
  }

  public async onWatchTutorial(tutorial: ITutorial): Promise<void> {
    const alert = await this.alertCtrl.create({
      header: tutorial.title,
      message: `This video tutorial (${tutorial.duration}) will be available soon.`,
      buttons: [{ text: 'OK', role: 'cancel' }],
    });
    await alert.present();
  }

  public async onContactSupport(): Promise<void> {
    const toast = await this.toastCtrl.create({
      message: 'Support chat coming soon. Upgrade to get Priority Support.',
      duration: 3000,
      color: 'primary',
      position: 'bottom',
    });
    await toast.present();
  }
}

