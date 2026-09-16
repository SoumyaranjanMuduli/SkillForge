insert into public.programs(id, slug, name, description, icon) values
('sql','sql','SQL','Basic to advanced SQL, analytics patterns, joins, CTEs and window functions.','database'),
('excel','excel','Excel','Formulas, lookups, cleaning, dates, statistics and analytics workflows.','sheet'),
('python','python','Python','Core Python, Pandas and practical data analysis problems.','code'),
('de','data-engineering','Data Engineering','ETL, data quality, modeling, SQL transformations and pipelines.','pipeline')
on conflict (id) do update set name=excluded.name, description=excluded.description;

insert into public.questions(id, program_id, topic, title, prompt, question_type, difficulty, marks, time_limit_sec, starter_code, answer_key, grading_mode)
values
('sql-1','sql','SELECT','Show all employee details.','Show all employee details.','sql','easy',5,180,'SELECT *\nFROM EMP;','SELECT * FROM EMP;','manual'),
('sql-2','sql','WHERE','Find employees earning more than 2000.','Find employees earning more than 2000.','sql','easy',5,180,NULL,'SELECT * FROM EMP WHERE SAL > 2000;','manual'),
('sql-3','sql','GROUP BY','Find the average salary in each department.','Find the average salary in each department.','sql','medium',5,300,NULL,'SELECT DEPTNO, AVG(SAL) AS AVG_SALARY FROM EMP GROUP BY DEPTNO;','manual'),
('sql-4','sql','HAVING','Find departments with more than 2 employees.','Find departments with more than 2 employees.','sql','medium',5,300,NULL,'SELECT DEPTNO, COUNT(*) AS EMP_COUNT FROM EMP GROUP BY DEPTNO HAVING COUNT(*) > 2;','manual'),
('sql-5','sql','SUBQUERY','Find employees earning more than KING.','Find employees earning more than KING.','sql','medium',10,420,NULL,'SELECT ENAME, SAL FROM EMP WHERE SAL > (SELECT SAL FROM EMP WHERE ENAME = ''KING'');','manual'),
('sql-6','sql','JOIN','Show employee name and department name.','Show employee name and department name.','sql','medium',10,420,NULL,'SELECT e.ENAME, d.DNAME FROM EMP e JOIN DEPT d ON e.DEPTNO = d.DEPTNO;','manual'),
('sql-7','sql','SELF JOIN','Show employee and manager name.','Show employee and manager name.','sql','hard',10,480,NULL,'SELECT e.ENAME AS EMPLOYEE, m.ENAME AS MANAGER FROM EMP e LEFT JOIN EMP m ON e.MGR = m.EMPNO;','manual'),
('sql-8','sql','WINDOW','Find top 3 employees in each department.','Find top 3 employees in each department.','sql','hard',10,600,NULL,'SELECT * FROM (SELECT e.*, ROW_NUMBER() OVER (PARTITION BY DEPTNO ORDER BY SAL DESC) rn FROM EMP e) x WHERE rn <= 3;','manual'),
('sql-9','sql','CTE','Create a CTE for employees earning over 1000.','Create a CTE for employees earning over 1000.','sql','hard',10,600,NULL,'WITH high_salary AS (SELECT * FROM EMP WHERE SAL > 1000) SELECT * FROM high_salary;','manual'),
('sql-10','sql','DATA QUALITY','Find duplicate salaries within departments.','Find duplicate salaries within departments.','sql','hard',10,600,NULL,'SELECT DEPTNO, SAL, COUNT(*) AS CNT FROM EMP GROUP BY DEPTNO, SAL HAVING COUNT(*) > 1;','manual'),
('excel-1','excel','SUM','Calculate total revenue from B2:B100.','Enter the Excel formula that calculates total revenue from B2:B100.','excel','easy',5,180,NULL,'=SUM(B2:B100)','exact'),
('excel-2','excel','IF','Return High when H2 is at least 50000, otherwise Normal.','Enter the Excel formula.','excel','easy',5,180,NULL,'=IF(H2>=50000,"High","Normal")','exact'),
('excel-3','excel','SUMIFS','Sum Revenue where Region is North and Status is Completed.','Enter the Excel formula.','excel','medium',5,240,NULL,'=SUMIFS(Sales[Revenue],Sales[Region],"North",Sales[Status],"Completed")','exact'),
('excel-4','excel','XLOOKUP','Return the customer segment for A2 using a Customer table.','Enter the Excel formula.','excel','medium',10,300,NULL,'=XLOOKUP(A2,Customer[CustomerID],Customer[Segment],"Not Found")','exact'),
('excel-5','excel','TEXT','Extract the username from an email in A2.','Enter the Excel formula.','excel','medium',5,240,NULL,'=TEXTBEFORE(A2,"@")','exact'),
('excel-6','excel','DATES','Calculate working days between A2 and B2.','Enter the Excel formula.','excel','hard',10,300,NULL,'=NETWORKDAYS(A2,B2)','exact'),
('python-1','python','Basics','Return the sum of all numbers in the list nums.','Write Python that returns the sum of nums.','python','easy',5,240,'nums = [10, 20, 30, 40]\n\n# return the answer','sum(nums)','manual'),
('python-2','python','Lists','Return a list containing only numbers greater than 10.','Write Python that filters nums.','python','easy',5,240,'nums = [5, 12, 3, 22, 17]\n\n# return the filtered list','[x for x in nums if x > 10]','manual'),
('python-3','python','Functions','Write a function that returns the average of a list.','Write the function.','python','medium',10,360,'def average(nums):\n    # write your code\n    pass','def average(nums): return sum(nums) / len(nums)','manual'),
('python-4','python','Pandas','Return the mean of df["salary"].','Write Pandas code that returns the mean salary.','python','medium',10,420,'import pandas as pd\ndf = pd.DataFrame({"salary": [800, 1200, 3000, 5000]})\n\n# return the mean','df["salary"].mean()','manual'),
('python-5','python','Data Cleaning','Return df after removing duplicate rows.','Write Pandas code that removes duplicate rows.','python','hard',10,420,'import pandas as pd\ndf = pd.DataFrame({"id": [1, 1, 2], "value": [10, 10, 20]})\n\n# return the cleaned dataframe','df.drop_duplicates()','manual')
on conflict (id) do update set answer_key=excluded.answer_key, prompt=excluded.prompt;

insert into public.questions(id, program_id, topic, title, prompt, question_type, difficulty, marks, time_limit_sec, starter_code, answer_key, grading_mode)
values
('de-1','de','ETL','Which stage cleans and transforms raw records before loading?','Answer the ETL stage.','text','easy',5,120,NULL,'Transform','exact'),
('de-2','de','Data Quality','Write the SQL pattern used to detect duplicate keys.','Return the SQL pattern.','text','medium',5,240,NULL,'GROUP BY id HAVING COUNT(*) > 1','exact'),
('de-3','de','Modeling','What is the purpose of a fact table?','Answer in one sentence.','text','medium',5,240,NULL,'Store measurable business events at a defined grain.','exact'),
('de-4','de','Pipelines','Name a common Python workflow tool for scheduled DAG-based pipelines.','Return the tool name.','text','medium',5,180,NULL,'Apache Airflow','exact'),
('de-5','de','SQL','Write a query that counts orders by customer.','Write the SQL query.','sql','medium',10,360,NULL,'SELECT customer_id, COUNT(*) FROM orders GROUP BY customer_id;','manual')
on conflict (id) do update set answer_key=excluded.answer_key, prompt=excluded.prompt;

insert into public.assessments(id,name,program_id,duration_sec,description,published)
values
('sql-level-1','SQL Level 1','sql',2700,'Foundations through joins and aggregation.',true),
('excel-level-1','Excel Level 1','excel',2100,'Functions, lookups, text and dates.',true),
('python-level-1','Python Level 1','python',2700,'Core Python and introductory data analysis.',true),
('de-level-1','Data Engineering Level 1','de',2400,'ETL, data quality, modeling and SQL.',true)
on conflict (id) do update set published=excluded.published;

insert into public.assessment_questions(assessment_id, question_id, position)
select 'sql-level-1', id, row_number() over(order by id) from public.questions where id like 'sql-%' and id <> 'sql-10'
on conflict do nothing;
insert into public.assessment_questions(assessment_id, question_id, position)
select 'excel-level-1', id, row_number() over(order by id) from public.questions where id like 'excel-%'
on conflict do nothing;
insert into public.assessment_questions(assessment_id, question_id, position)
select 'python-level-1', id, row_number() over(order by id) from public.questions where id like 'python-%'
on conflict do nothing;
insert into public.assessment_questions(assessment_id, question_id, position)
select 'de-level-1', id, row_number() over(order by id) from public.questions where id like 'de-%'
on conflict do nothing;
