"""Simple test to verify Arcade is working."""
import arcade

class TestWindow(arcade.Window):
    def __init__(self):
        super().__init__(800, 600, "Test Window")
        arcade.set_background_color(arcade.color.BLUE)
        
    def on_draw(self):
        self.clear()
        arcade.draw_text("Hello World!", 400, 300, arcade.color.WHITE, 40, anchor_x="center")

if __name__ == "__main__":
    window = TestWindow()
    arcade.run()
