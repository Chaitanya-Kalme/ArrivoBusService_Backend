
import dotenv from "dotenv"
import app from "./app"

dotenv.config({
    path: "./.env"
})


app.listen(8000, () => {
  console.log('Server running on port 8000');
});
