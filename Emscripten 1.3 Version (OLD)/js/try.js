// Helper function used to obtain the number of keys in an object
Object.size = function(obj) {
    var size = 0, key;
    for (key in obj) {
        if (obj.hasOwnProperty(key)) size++;
    }
    return size;
};

// Updates the explanation text to be that of lesson_id
function load_text(lesson_id){
  var $ceu_slide = $("#ceu-slide-text");
  
  // Update the title
  $ceu_slide
    .children("h3")
    .html(Lessons[lesson_id].name);
  
  // Update the explanation
  $ceu_slide
    .children("div")
    .html(Lessons[lesson_id].text);
}
// Sets the lesson code to that of the provided lesson_id
function load_code(lesson_id){
  $("#ceu-code-container textarea").val(Lessons[lesson_id].code);
}

// Sets the lesson input to that of the provided lesson_id
function load_input(lesson_id){
  $("#ceu-input-text textarea").val(Lessons[lesson_id].input + "    \n\
/*                                                                  \n\
 * Any comments or questions about this example?                    \n\
 * Fill in this space and \"Run\" the example.                      \n\
 * We'll get an e-mail with your comments.                          \n\
 *                                                                  \n\
 * NAME:                                                            \n\
 * E-MAIL:                                                          \n\
 * COMMENTS:                                                        \n\
 *                                                                  \n\
 *                                                                  \n\
 */                                                                 \n\
"
)
}

// Updates the lesson number displayed in the Lesson panel textbar
// to be equal to lesson_num. Also updates the current slide reference,
// in the Slides object, to lesson_num
function update_number(lesson_num){
  $("#ceu-slide-number").text(lesson_num);
  Slides.cur_slide = lesson_num;
}

function clear_results(){
  $("#ceu-results-text").empty();
}

// Object used to load a new lesson; it holds also holds the [lesson_id -> numeric_id] array
var Slides = {
  cur_slide: 1,
  slides: [
    "ex000_intro",   "ex010_hello",    "ex020_events",   "ex030_parand",
    "ex040_paror",   "ex050_term",     "ex060_par",      "ex070_AB",
    "ex080_tight",   "ex090_det01",    "ex120_inthello", "ex140_intstack",
    "ex150_async10", "ex160_async0",   "ex170_simul",    "ex180_cblock",
/*
    "ex190_fin",
    "ex130_intvars",
    "ex100_atomic",
 "ex_det02", "ex_det03", "ex_det04",
 "ex_glitch", "ex_m4"
*/
  ],
  next: function(){
    this.cur_slide++;
    
    if(this.cur_slide > this.slides.length){
      this.cur_slide = 1;
    }
    
    load_lesson(this.cur_slide);
  },
  previous: function(){
    this.cur_slide--;
    
    if(this.cur_slide == 0){
      this.cur_slide = this.slides.length;
    }
    
    load_lesson(this.cur_slide);
  }
};

var ORIG_CODE  = '';
var ORIG_INPUT = '';

// Loads the lesson of numeric_id equal to index
function load_lesson(index){
  lesson_id = Slides.slides[index - 1];

  update_number(index);
  load_text(lesson_id);
  load_code(lesson_id);
  load_input(lesson_id); 
  clear_results();

  ORIG_CODE  = $("#ceu-code-container textarea").val();
  ORIG_INPUT = $("#ceu-input-text textarea").val();
}  

// Increase/decrease font size by diff px
function change_font_size(diff){
  var $body = $('body'),
      cur_font_size = $body.css('font-size');
  
  cur_font_size = parseFloat(cur_font_size, 10) + diff;
  
  if(cur_font_size > 0){
    $body.css('font-size', cur_font_size);
  }
}
