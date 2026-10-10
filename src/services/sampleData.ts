import type { Story, Chapter } from '../types';

export const INITIAL_SAMPLE_STORY: { story: Story; chapters: Chapter[] } = {
  story: {
    id: 'sample_chill_reader_guide',
    title: 'Hành Trình Tu Tiên: Khởi Đầu Giới Tu Chân',
    author: 'Chill Reader Team',
    description: 'Bộ truyện mẫu trải nghiệm các tính năng đọc mượt mà và nghe audio TTS tiếng Việt đỉnh cao của ứng dụng Chill Reader.',
    coverUrl: 'https://images.unsplash.com/photo-1518709268805-4e9042af9f23?w=400&q=80',
    totalChapters: 3,
    currentChapterNumber: 1,
    currentProgressPercent: 0,
    currentSentenceIndex: 0,
    source: 'local_txt',
    isFavorite: true,
    tags: ['TU TIÊN', 'HUYỀN HUYỄN', 'AUDIO'],
    lastReadAt: Date.now(),
    createdAt: Date.now()
  },
  chapters: [
    {
      id: 'sample_ch_1',
      storyId: 'sample_chill_reader_guide',
      chapterNumber: 1,
      title: 'Chương 1: Bình Minh Bên Đỉnh Phù Vân',
      content: `Sáng sớm, trên đỉnh núi Phù Vân, từng làn sương trắng bồng bềnh tựa như dải lụa mỏng vắt ngang lưng trời. 

Tiếng chim hót ríu rít vang vọng giữa rừng trúc xanh biếc, hòa cùng tiếng suối róc rách chảy qua những phiến đá rêu phong. 

Gió sớm thổi qua mang theo hơi lạnh thanh khiết của đất trời, làm lay động vạt áo bào màu lam nhạt của thiếu niên đang tĩnh tọa trên tảng đá lớn.

Thiếu niên tên là Lâm Phong. Hắn từ từ mở mắt, trong con ngươi ánh lên một tia sáng trong vắt tựa làn nước mùa thu. 

Hít sâu một hơi linh khí thanh thuần buổi sớm, Lâm Phong khẽ thở phào một tiếng:

"Ba năm khổ tu, rốt cuộc hôm nay cũng chạm tới bình cảnh Luyện Khí tầng thứ ba!"

Thế giới này vô cùng rộng lớn, người phàm theo đuổi con đường tu tiên trường sinh bất lão nhiều vô số kể, nhưng kẻ thực sự bước lên đỉnh cao đại đạo lại như phượng mao lân giác.

Lâm Phong đứng dậy, phủi nhẹ tà áo rồi hướng mắt nhìn về phía chân trời xa xăm, nơi vầng thái dương đỏ rực đang dần nhô lên xua tan bóng đêm tăm tối.

Một cuộc hành trình mới đầy gian nan và kỳ ngộ đang chờ đợi hắn ở phía trước.`
    },
    {
      id: 'sample_ch_2',
      storyId: 'sample_chill_reader_guide',
      chapterNumber: 2,
      title: 'Chương 2: Kỳ Ngộ Trong Hang Động',
      content: `Dưới chân núi Phù Vân có một thung lũng bí ẩn quanh năm mây mù bao phủ, người dân quanh vùng gọi đó là U Linh Cốc.

Tương truyền trăm năm trước, từng có một vị tiền bối Kim Đan kỳ vẫn lạc tại nơi này, để lại truyền thừa vô giá.

Lâm Phong cẩn thận từng bước lần theo lối mòn dốc đứng. Bỗng nhiên, một luồng tử quang nhàn nhạt lóe lên từ khe đá phủ đầy dây leo cổ thụ.

Tâm niệm vừa động, hắn liền rút thanh đoản kiếm bên hông, gạt phăng đám rậm rạp để tiến vào sâu bên trong.

Bên trong là một thạch động rộng rãi và khô ráo. Ở giữa động đặt một chiếc đài sen bằng ngọc trắng nguyên khối, phía trên lơ lửng một cuốn cổ tịch bằng da thú phát ra ánh sáng lung linh huyền ảo.

"Chẳng lẽ đây là... bí kíp tâm pháp trong truyền thuyết?"

Lâm Phong nín thở, chậm rãi vươn tay chạm nhẹ vào cuốn cổ thư. 

Ngay khoảnh khắc đầu ngón tay chạm vào bề mặt da thú, một luồng ấm áp kỳ diệu lập tức tràn ngập toàn thân kinh mạch!`
    },
    {
      id: 'sample_ch_3',
      storyId: 'sample_chill_reader_guide',
      chapterNumber: 3,
      title: 'Chương 3: Bước Lên Đỉnh Phong',
      content: `Thời gian thấm thoắt thoi đưa, nửa năm bế quan khổ luyện trong thạch động trôi qua như một cái chớp mắt.

Khi Lâm Phong bước ra khỏi sơn động, khí tức trên người hắn đã hoàn toàn thay đổi. Không còn là thiếu niên gầy gò yếu ớt ngày nào, mà là một tu sĩ vững vàng, thần thái thong dong tự tại.

Gió núi thổi lồng lộng qua vách đá, vạn dặm non sông thu trọn vào tầm mắt.

Hắn khẽ cười, cất bước đi xuống núi:

"Đại đạo mênh mông vô tận, hôm nay ta chính thức nhập thế, một tấc lòng son quyết không lùi bước!"

Từ đó về sau, tên tuổi của hắn bắt đầu vang danh khắp thiên hạ, mở ra một huyền thoại bất hủ trường tồn cùng tuế nguyệt.`
    }
  ]
};
