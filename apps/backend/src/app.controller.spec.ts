import { Test, type TestingModule } from "@nestjs/testing";
import { AppController } from "./app.controller";
import { EventService } from "./event/event.service";

describe("AppController", () => {
  let appController: AppController;

  const eventServiceMock = {
    publish: jest.fn(),
    getAdapter: jest.fn(),
  };

  beforeEach(async () => {
    const app: TestingModule = await Test.createTestingModule({
      controllers: [AppController],
      providers: [
        {
          provide: EventService,
          useValue: eventServiceMock,
        },
      ],
    }).compile();

    appController = app.get<AppController>(AppController);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it("should be defined", () => {
    expect(appController).toBeDefined();
  });
});