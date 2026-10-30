import test from "@playwright/test";
import { readZymmrRecords } from "../src/utils/excelReader";

// Fetch data from zymmer records.xlsx
const records = readZymmrRecords();

function parseDateParts(dateVal: any) {
  if (!dateVal) return null;
  const str = String(dateVal).trim();
  let d = 0, m = 0, y = 0;
  const dmy = str.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})$/);
  if (dmy) {
    d = parseInt(dmy[1], 10);
    m = parseInt(dmy[2], 10);
    y = parseInt(dmy[3], 10);
  } else if (/^\d{5}$/.test(str)) {
    const date = new Date(Math.round((Number(str) - 25569) * 86400 * 1000));
    d = date.getUTCDate();
    m = date.getUTCMonth() + 1;
    y = date.getUTCFullYear();
  } else {
    const date = new Date(str);
    if (!isNaN(date.getTime())) {
      d = date.getDate();
      m = date.getMonth() + 1;
      y = date.getFullYear();
    }
  }
  if (!d || !m || !y) return null;
  const months = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ];
  return {
    day: d,
    month: m,
    year: y,
    monthName: months[m - 1],
    ariaLabel: `${months[m - 1]} ${d}, ${y}`
  };
}

test.describe.configure({ mode: 'serial' });

records.forEach((record, index) => {
  test(`Row ${index + 1}: adding zymmr record for ${record.SubTaskID} - ${record['Task Name'] || 'Task'}`, async ({ page }) => {
    test.slow();
    await page.goto('https://flairminds.zymmr.com/frontend/login/');

    // Sign in page - populate credentials from Excel
    await page.getByRole('textbox', { name: 'Enter your email' }).fill(record.Username);
    await page.getByLabel('Password', { exact: true }).fill(record.Password);
    await page.getByRole('button', { name: 'Login' }).click();

    // Wait for authentication and redirect away from login page
    await page.waitForURL((url) => !url.href.includes('/login/'), { timeout: 15000 }).catch(() => { });
    await page.waitForLoadState('networkidle');

    // Dashboard page - dynamic SubTaskID from Excel
    await page.goto(`https://flairminds.zymmr.com/frontend/work-items/${record.SubTaskID}`);
    await page.getByText('Sub Tasks', { exact: true }).click();
    await page.getByRole('button', { name: 'Add Sub-Task' }).click();
    await page.getByPlaceholder('Select Type').click();
    await page.getByRole('option', { name: 'Sub-Task', exact: true }).click();
    const taskInput = page.locator('div.grow input');
    await taskInput.fill(record['Task Name'] || '');
    await taskInput.press('Enter');

    // Locate the table row matching the created Task Name and click its generated ID link
    const taskName = record['Task Name'] || '';
    const taskRow = page.locator('tbody tr').filter({ hasText: taskName });
    const taskIdLink = taskRow.locator('td').first().locator('a');

    // Wait for the unique ID link to appear in the table
    await taskIdLink.waitFor({ state: 'visible' });
    const generatedTaskId = (await taskIdLink.innerText()).trim();
    console.log(`Generated Sub-Task ID: ${generatedTaskId}`);

    // Click on the unique Task ID link
    await taskIdLink.click();
    await page.waitForLoadState('networkidle');

    const primaryAssignee = page
      .getByText('Primary Assignee', { exact: true })
      .locator('xpath=following::*[@role="combobox"]')
      .first();
    await primaryAssignee.click();
    await page.getByRole('option', { name: 'Lalit Jadhav', exact: true }).click();
    if (record.Description) {
      // Click preview to open edit mode if visible
      const preview = page.locator('#taskDescription');
      if (await preview.isVisible().catch(() => false)) {
        await preview.click();
      }

      // Wait for Save button to appear (indicating edit mode is active)
      const saveBtn = page.getByRole('button', { name: 'Save' });
      await saveBtn.waitFor({ state: 'visible', timeout: 5000 });

    }
    await page.getByText('Open', { exact: true }).click();
    await page.getByRole('option', { name: 'In Progress', exact: true }).click();
    await page.getByText('In Progress', { exact: true }).click();
    await page.getByRole('option', { name: 'Done', exact: true }).click();
    await page.getByText('Time log', { exact: true }).click();
    await page.getByRole('button', { name: 'Add Time Log' }).click();
    await page.getByPlaceholder('Select Work Type').click();

    await page.getByRole('option', { name: record.worktype ?? '', exact: true }).click();
    await page.getByPlaceholder('Select date').click();
    let dateVal = String(record["Start Date "] || '').trim();
    const dateParts = parseDateParts(dateVal);
    if (dateParts) {
      dateVal = dateParts.ariaLabel;
    }
    const dateCell = page
      .locator(`xpath=(//span[@aria-label='${dateVal}'])[6]`)
      .or(page.locator(`xpath=(//span[@aria-label='${dateVal}'])[last()]`));
    await dateCell.first().click();

    await page.getByRole('textbox', { name: 'Time' }).fill(String(record["Time Log"] || ''));
    await page.getByRole('textbox', { name: 'Enter description' }).fill(record.Description || '');
    const addBtn = page.getByRole('button', { name: 'Add', exact: true }).or(page.getByText('Add', { exact: true }));
    await addBtn.click();
    await page.waitForLoadState('networkidle').catch(() => {});
    await page.context().close();
  });
});
