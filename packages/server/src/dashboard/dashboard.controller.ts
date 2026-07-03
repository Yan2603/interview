import { Controller, Get } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Question } from '../questions/question.schema';
import { InterviewEvent } from '../events/event.schema';

@Controller('dashboard')
export class DashboardController {
  constructor(
    @InjectModel(Question.name) private questionModel: Model<Question>,
    @InjectModel(InterviewEvent.name) private eventModel: Model<InterviewEvent>,
  ) {}

  @Get()
  async summary() {
    const now = new Date();
    const weekLater = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

    const [upcomingEvents, masteryStats, totalQuestions] = await Promise.all([
      this.eventModel
        .find({ start: { $gte: now, $lte: weekLater }, status: 'scheduled' })
        .sort({ start: 1 })
        .limit(5)
        .lean(),
      this.questionModel.aggregate([
        { $group: { _id: '$mastery', count: { $sum: 1 } } },
      ]),
      this.questionModel.countDocuments(),
    ]);

    const mastery: Record<string, number> = { new: 0, reviewing: 0, mastered: 0 };
    for (const row of masteryStats) {
      mastery[row._id as string] = row.count;
    }

    return { upcomingEvents, mastery, totalQuestions };
  }
}
